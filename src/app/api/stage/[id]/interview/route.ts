import { NextResponse } from "next/server";
import { getStage, getPlan, getChatHistory, addChatMessage } from "@/db/queries";
import { getModel } from "@/lib/llm";
import { generateText } from "ai";
import { getDb } from "@/db/schema";
import { loadStageCodeContext } from "@/lib/code-project";

function getInterviewChatId(stageId: string, style: string) {
  return `stage_interview_${stageId}_${style}`;
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
2. 从本阶段核心概念开始，逐渐深入实现细节
3. 对每个回答追问 1-2 个 follow-up 问题
4. 考察：基础概念 → 设计决策 → 性能/边界 → 落地实现
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageId } = await params;
  const style = new URL(request.url).searchParams.get("style") || "standard";
  const history = getChatHistory(getInterviewChatId(stageId, style));
  return NextResponse.json(history);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageId } = await params;
  const stage = getStage(stageId);
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }
  if (stage.status === "locked") {
    return NextResponse.json({ error: "请先解锁该阶段后再进行面试模拟" }, { status: 403 });
  }

  const plan = getPlan(stage.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  let body: { message?: string; style?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const { message, style = "standard" } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.standard;
  const chatId = getInterviewChatId(stageId, style);

  try {
    addChatMessage(chatId, "user", message);

    const history = getChatHistory(chatId);
    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let codeContext = "";
    if (plan.source_type === "code" && plan.source_path) {
      codeContext = loadStageCodeContext({
        sourcePath: plan.source_path,
        filePaths: plan.source_files || [],
        stageTitle: stage.title,
        keyTopics: stage.key_topics,
        maxChars: 10000,
      });
    }

    const systemPrompt = `你是一位${styleConfig.name}。你正在对一位学习者进行「本阶段专项」技术面试。

## 面试官性格
${styleConfig.personality}

## 项目与阶段范围（严格限定）
- 学习计划: ${plan.title}
- 学习目标: ${plan.goal_description}
- 当前面试阶段: 第 ${stage.order_index + 1} 阶段「${stage.title}」
- 阶段描述: ${stage.description}
- 本阶段知识点: ${stage.key_topics.join("、")}
- 本阶段目标产出: ${stage.core_output || "无"}
${stage.summary_text ? `- 阶段导读摘要: ${stage.summary_text.slice(0, 1200)}` : ""}

## 面试规则（严格遵守）
${styleConfig.rules}
- 问题必须紧扣本阶段知识点与导读内容，不要提前考后续阶段
- 可以围绕原理、设计决策、实现细节、边界场景、面试常见追问展开
- 每次只问一个问题
${codeContext ? `
## 本阶段相关源码（可用于出题与追问）
${codeContext}

出题时优先要求候选人结合具体文件/函数回答；若其回答空泛，追问“对应到哪段代码”。
` : ""}

## 如果这是面试的开始
如果对话历史为空或只有 1 条消息（如“开始面试”），先做简短开场，说明本次只考察本阶段，然后抛出第一个问题。`;

    const model = getModel();
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: chatMessages,
    });

    addChatMessage(chatId, "assistant", text);
    return NextResponse.json({ role: "assistant", content: text });
  } catch (e) {
    console.error("[stage/interview] POST failed:", e);
    return NextResponse.json({ error: (e as Error).message || "面试失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageId } = await params;
  const style = new URL(request.url).searchParams.get("style") || "standard";
  const chatId = getInterviewChatId(stageId, style);
  const db = getDb();
  db.prepare("DELETE FROM teaching_chat WHERE stage_id = ?").run(chatId);
  return NextResponse.json({ ok: true });
}
