import { NextResponse } from "next/server";
import { getStage, getChatHistory, addChatMessage, getPlan } from "@/db/queries";
import { getConfig } from "@/db/queries";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const history = getChatHistory(id);
  return NextResponse.json(history);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stage = getStage(id);
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const plan = getPlan(stage.plan_id);
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  addChatMessage(id, "user", message);

  const history = getChatHistory(id);
  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const systemPrompt = `你是一位苏格拉底式的导师。你正在一对一地教导一位学习者。

## 你的教学对象正在学习
- 整体目标: ${plan?.goal_description || "未知"}
- 当前阶段: ${stage.title}
- 阶段描述: ${stage.description}
- 核心知识点: ${stage.key_topics.join("、")}
${plan?.user_motivation ? `- 学习动机: ${plan.user_motivation}` : ""}
${plan?.user_background ? `- 学习者背景: ${plan.user_background}` : ""}

## 教学规则（严格遵守）

1. **不要直接灌输知识**。通过提问引导学习者自己思考和发现答案。
2. **每次回复最多讲一个概念**。不要一次性倒出大量信息。
3. **总是以一个问题结尾**。让学习者思考。
4. **如果学习者回答正确**，给予肯定（如"很好！"、"没错！"），然后引导到下一个更深的知识点。
5. **如果学习者回答不完整或错误**，不要直接纠正，而是追问引导（如"你说的有道理，但如果从X角度思考呢？"）。
6. **用类比和现实例子**解释抽象概念。
7. **适时给予鼓励**。保持学习者的信心和动力。
8. **语言风格**：亲切、专业、简洁。避免学术腔调。

## 如果这是对话的开始
如果对话历史为空或只有1条消息，先做一个简短的破冰介绍，然后抛出第一个引导性问题，引入本阶段最核心的知识点。`;

  try {
    const model = getModel();
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: chatMessages,
    });

    addChatMessage(id, "assistant", text);

    return NextResponse.json({
      role: "assistant",
      content: text,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
