import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getConfig, getStage, type ReviewSchedule } from "@/db/queries";
import { getDb } from "@/db/schema";

function getModel() {
  const config = getConfig();
  if (!config.llm_api_key) throw new Error("请先配置 API Key");

  if (config.llm_provider === "anthropic") {
    const provider = createAnthropic({
      apiKey: config.llm_api_key,
      baseURL: config.llm_base_url || undefined,
    });
    return provider(config.llm_model || "claude-sonnet-4-20250514");
  }

  if (config.llm_provider === "deepseek") {
    const provider = createOpenAI({
      apiKey: config.llm_api_key,
      baseURL: config.llm_base_url || "https://api.deepseek.com/v1",
    });
    return provider.chat(config.llm_model || "deepseek-chat");
  }

  const provider = createOpenAI({
    apiKey: config.llm_api_key,
    baseURL:
      config.llm_base_url ||
      (config.llm_provider === "deepseek"
        ? "https://api.deepseek.com/v1"
        : undefined),
  });
  return provider(config.llm_model || "gpt-4o-mini");
}

interface ReviewQuestion {
  question: string;
  type: "choice" | "fill" | "short_answer";
  options?: string[];
  answer: string;
}

function extractJsonArray(text: string): ReviewQuestion[] {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : text.trim();
  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed) ? parsed : parsed.questions ?? [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const schedule = db
      .prepare("SELECT * FROM review_schedule WHERE id = ?")
      .get(id) as ReviewSchedule | undefined;

    if (!schedule) {
      return NextResponse.json({ error: "Review schedule not found" }, { status: 404 });
    }

    const stage = getStage(schedule.stage_id);
    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const prompt = `你是一位学习复习出题专家。请根据以下阶段内容生成 3-5 道快速复习题。

## 阶段信息
- 阶段名称: ${stage.title}
- 核心知识点: ${stage.key_topics.join("、")}
- 学习目标: ${(stage.learning_objectives || []).join("；")}

## 出题要求
1. 生成 3-5 道题，覆盖核心知识点
2. 题型多样化，包含 choice（选择题）、fill（填空题）、short_answer（简答题）
3. 选择题需提供 4 个选项（options 数组）
4. 每道题必须包含标准答案（answer 字段）
5. 题目难度适中，用于间隔复习巩固记忆

请严格以 JSON 数组格式输出，不要输出其他内容：
[
  {
    "question": "题目内容",
    "type": "choice",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": "正确答案"
  }
]`;

    const model = getModel();
    const { text } = await generateText({ model, prompt });
    const questions = extractJsonArray(text);

    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
