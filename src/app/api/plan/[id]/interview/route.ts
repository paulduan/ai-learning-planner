import { NextResponse } from "next/server";
import { getPlan, getStagesByPlan, getChatHistory, addChatMessage, getConfig } from "@/db/queries";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

function getModel() {
  const config = getConfig();
  if (!config.llm_api_key) throw new Error("请先配置 API Key");

  if (config.llm_provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: config.llm_api_key,
      ...(config.llm_base_url ? { baseURL: config.llm_base_url } : {}),
    });
    return anthropic(config.llm_model || "claude-sonnet-4-20250514");
  }

  if (config.llm_provider === "deepseek") {
    const deepseek = createOpenAI({
      apiKey: config.llm_api_key,
      baseURL: config.llm_base_url || "https://api.deepseek.com/v1",
    });
    return deepseek.chat(config.llm_model || "deepseek-chat");
  }

  const openai = createOpenAI({
    apiKey: config.llm_api_key,
    ...(config.llm_base_url ? { baseURL: config.llm_base_url } : {}),
  });
  return openai(config.llm_model || "gpt-4o-mini");
}

function getInterviewStageId(planId: string, style: string) {
  return `interview_${planId}_${style}`;
}

const STYLE_PROMPTS: Record<string, { name: string; personality: string; rules: string }> = {
  friendly: {
    name: "友善型面试官",
    personality: `你是一位友善、亲切的技术面试官，像一位经验丰富的同事在和候选人聊天。
- 语气温和，鼓励为主
- 当候选人回答不够好时，会给提示引导，而不是直接否定
- 会分享自己的理解来帮助候选人思考
- 偶尔用轻松的语气缓解紧张感`,
    rules: `1. 先做自我介绍，营造轻松氛围
2. 问题从简单到复杂，循序渐进
3. 候选人答不出来时给出适当提示
4. 每次只问一个问题，等回答后再继续
5. 保持鼓励和正面反馈`,
  },
  standard: {
    name: "标准技术面试官",
    personality: `你是一位专业的技术面试官，模拟真实的技术面试场景。
- 语气专业、客观、中立
- 关注候选人的技术深度和广度
- 会对不完整的回答追问细节
- 根据回答质量调整后续问题难度`,
    rules: `1. 开场简短介绍面试流程
2. 从项目整体架构开始，逐渐深入技术细节
3. 对每个回答追问 1-2 个follow-up问题
4. 考察：基础概念 → 设计决策 → 性能优化 → 异常处理
5. 每次只问一个问题`,
  },
  tough: {
    name: "压力面试官",
    personality: `你是一位严格的资深架构师，以高标准要求候选人。
- 语气直接，不绕弯子
- 会挑战候选人的每一个回答，要求更深层的解释
- 关注边界情况、异常处理、性能瓶颈
- 如果回答含糊，会直接指出并要求具体化`,
    rules: `1. 开门见山，直接开始提问
2. 每个回答至少追问"为什么"或"如果…会怎样"
3. 主动找回答中的漏洞和假设
4. 问一些有挑战性的反面问题（如"这个设计有什么缺点"）
5. 保持专业，严格但不刻薄
6. 每次只问一个问题`,
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const url = new URL(_request.url);
  const style = url.searchParams.get("style") || "standard";
  const stageId = getInterviewStageId(planId, style);
  const history = getChatHistory(stageId);
  return NextResponse.json(history);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const body = await request.json();
  const { message, style = "standard" } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.standard;
  const stageId = getInterviewStageId(planId, style);

  addChatMessage(stageId, "user", message);

  const history = getChatHistory(stageId);
  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stages = getStagesByPlan(planId);
  const stagesSummary = stages.map((s) =>
    `阶段${s.order_index + 1}: ${s.title}\n  知识点: ${s.key_topics.join("、")}\n  描述: ${s.description}`
  ).join("\n\n");

  const systemPrompt = `你是一位${styleConfig.name}。你正在对一位学习者进行技术面试，考察他对一个技术项目的理解。

## 面试官性格
${styleConfig.personality}

## 项目信息
- 项目: ${plan.title}
- 学习目标: ${plan.goal_description}

## 候选人已学习的内容
${stagesSummary}

## 面试规则（严格遵守）
${styleConfig.rules}

## 面试范围
- 基于候选人已学习的阶段内容进行提问
- 可以考察：技术原理、设计决策、代码实现、性能优化、异常处理、系统架构
- 面试问题必须和项目学习内容相关

## 如果这是面试的开始
如果对话历史为空或只有1条消息（如"开始面试"），先做面试开场白，然后抛出第一个面试问题。`;

  try {
    const model = getModel();
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: chatMessages,
    });

    addChatMessage(stageId, "assistant", text);

    return NextResponse.json({
      role: "assistant",
      content: text,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const url = new URL(request.url);
  const style = url.searchParams.get("style") || "standard";
  const stageId = getInterviewStageId(planId, style);

  const { getDb } = await import("@/db/schema");
  const db = getDb();
  db.prepare("DELETE FROM teaching_chat WHERE stage_id = ?").run(stageId);

  return NextResponse.json({ ok: true });
}
