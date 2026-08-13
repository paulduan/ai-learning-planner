import { NextResponse } from "next/server";
import { getStage, getChatHistory, addChatMessage, getPlan } from "@/db/queries";
import { getModel } from "@/lib/llm";
import { generateText } from "ai";
import { loadStageCodeContext } from "@/lib/code-project";

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

  const isCodePlan = plan?.source_type === "code" && !!plan.source_path;
  let codeContext = "";
  if (isCodePlan && plan) {
    codeContext = loadStageCodeContext({
      sourcePath: plan.source_path,
      filePaths: plan.source_files || [],
      stageTitle: stage.title,
      keyTopics: stage.key_topics,
    });
  }

  const systemPrompt = isCodePlan
    ? `你是一位「对着源码教」的代码导师。你正在带学习者读真实项目代码，而不是空讲概念。

## 学习对象
- 整体目标: ${plan?.goal_description || "未知"}
- 源码路径: ${plan?.source_path || "未知"}
- 当前阶段: ${stage.title}
- 阶段描述: ${stage.description}
- 核心知识点: ${stage.key_topics.join("、")}
${plan?.user_motivation ? `- 学习动机: ${plan.user_motivation}` : ""}
${plan?.user_background ? `- 学习者背景: ${plan.user_background}` : ""}

## 项目文件树（节选）
${(plan?.source_file_tree || "").slice(0, 3500)}

## 本阶段相关源码
${codeContext || "（暂未能读取源码，请基于阶段导读与知识点教学，并提醒用户确认本地路径仍可用）"}

## 教学规则（严格遵守）
1. 每次只推进一个小点：优先围绕「一个文件 / 一个函数 / 一条调用链」。
2. 解释时必须引用具体相对路径与符号名（如 \`internal/user/service.go\` 的 \`CreateUser\`）。
3. 用苏格拉底提问：先让学习者说出某段代码在做什么，再追问为什么这样设计。
4. 不要大段粘贴代码；需要时只引用关键 5-15 行，并说明上下文。
5. 若学习者回答空泛，要求他指到具体文件或函数。
6. 每次回复以一个具体问题结尾（例如：打开某某文件，告诉我入口函数做了哪三件事）。
7. 语言亲切、专业、简洁；用现实类比辅助，但最终要落到代码。

## 对话开始
如果历史为空或只有 1 条消息，先指出本阶段要精读的文件清单，然后抛出第一个读码问题。`
    : `你是一位苏格拉底式的导师。你正在一对一地教导一位学习者。

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
