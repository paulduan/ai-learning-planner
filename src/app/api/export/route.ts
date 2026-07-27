import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import fs from "fs";
import path from "path";
import {
  getConfig,
  getPlan,
  getStagesByPlan,
  getProjectsByPlan,
  getPlanStats,
  createExportRecord,
  getExportsByPlan,
} from "@/db/queries";

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

function ensureExportDir(planId: string): string {
  const dataRoot = process.env.APP_DATA_DIR || path.join(process.cwd(), "data");
  const dir = path.join(dataRoot, "exports", planId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function generateCertificateHtml(
  plan: NonNullable<ReturnType<typeof getPlan>>,
  stages: ReturnType<typeof getStagesByPlan>,
  stats: ReturnType<typeof getPlanStats>
): string {
  const completionDate = plan.completed_at
    ? new Date(plan.completed_at).toLocaleDateString("zh-CN")
    : new Date().toLocaleDateString("zh-CN");
  const stageList = stages
    .map(
      (s) =>
        `<li><strong>${s.title}</strong> — ${s.status === "completed" ? "已完成" : s.status}</li>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>学习证书 - ${plan.title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 40px; border: 3px double #333; }
    h1 { text-align: center; font-size: 2.5em; margin-bottom: 0.2em; }
    .subtitle { text-align: center; color: #666; margin-bottom: 2em; }
    .meta { text-align: center; line-height: 2; }
    ul { line-height: 1.8; }
    .footer { text-align: center; margin-top: 3em; color: #888; }
  </style>
</head>
<body>
  <h1>学习完成证书</h1>
  <p class="subtitle">${plan.title}</p>
  <div class="meta">
    <p><strong>学习目标：</strong>${plan.goal_description}</p>
    <p><strong>完成日期：</strong>${completionDate}</p>
    <p><strong>总学习时长：</strong>${Math.round(stats.totalStudyMinutes / 60 * 10) / 10} 小时</p>
    <p><strong>阶段进度：</strong>${stats.completedStages} / ${stats.totalStages} 阶段完成</p>
  </div>
  <h2>学习阶段</h2>
  <ul>${stageList}</ul>
  <p class="footer">AI Learning Planner · 精细化学习规划</p>
</body>
</html>`;
}

function generatePortfolioHtml(
  plan: NonNullable<ReturnType<typeof getPlan>>,
  projects: ReturnType<typeof getProjectsByPlan>
): string {
  const completed = projects.filter((p) => p.status === "completed");
  const projectCards = completed
    .map(
      (p) => `
    <div class="project">
      <h3>${p.title}</h3>
      <p class="stage">阶段: ${p.stage_title}</p>
      <p>${p.description || p.expected_output}</p>
      ${p.output_notes ? `<div class="notes"><strong>产出笔记：</strong>${p.output_notes}</div>` : ""}
      <ul>${(p.checklist || []).filter((c) => c.completed).map((c) => `<li>${c.item}</li>`).join("")}</ul>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>作品集 - ${plan.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 32px; background: #f9f9f9; }
    h1 { color: #1a1a1a; }
    .project { background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stage { color: #666; font-size: 0.9em; }
    .notes { background: #f0f4ff; padding: 12px; border-radius: 4px; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>${plan.title} — 作品集</h1>
  <p>学习目标：${plan.goal_description}</p>
  <p>已完成项目：${completed.length} / ${projects.length}</p>
  ${projectCards || "<p>暂无已完成的项目</p>"}
</body>
</html>`;
}

async function generateResumeMarkdown(
  plan: NonNullable<ReturnType<typeof getPlan>>,
  stages: ReturnType<typeof getStagesByPlan>,
  stats: ReturnType<typeof getPlanStats>
): Promise<string> {
  const completedStages = stages.filter((s) => s.status === "completed");
  const skills = [...new Set(stages.flatMap((s) => s.key_topics))].slice(0, 15);

  const prompt = `你是一位专业的简历顾问。请根据以下学习经历，生成适合放入简历的项目/技能描述（Markdown 格式）。

## 学习计划
- 标题: ${plan.title}
- 目标: ${plan.goal_description}
- 学习者背景: ${plan.user_background || "自学"}
- 期望成果: ${plan.expected_outcome || "掌握相关技能"}
- 总学习时长: ${stats.totalStudyMinutes} 分钟
- 完成阶段: ${stats.completedStages}/${stats.totalStages}

## 已完成阶段
${completedStages.map((s) => `- ${s.title}: ${s.core_output || s.description}\n  知识点: ${s.key_topics.join("、")}`).join("\n")}

## 技能关键词
${skills.join("、")}

请输出 Markdown 格式，包含：
1. ## 技能摘要（3-5 个 bullet points）
2. ## 学习项目经历（每个已完成阶段 1-2 个 STAR 格式的 bullet points）
3. ## 核心技能列表

使用中文，语言专业简洁，适合求职简历。`;

  const model = getModel();
  const { text } = await generateText({ model, prompt });
  return text;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json({ error: "缺少 plan_id 参数" }, { status: 400 });
    }

    const exports = getExportsByPlan(planId);
    return NextResponse.json(exports);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plan_id, type } = body;

    if (!plan_id || !type) {
      return NextResponse.json(
        { error: "缺少 plan_id 或 type 参数" },
        { status: 400 }
      );
    }

    if (!["certificate", "resume", "portfolio"].includes(type)) {
      return NextResponse.json(
        { error: "无效的 type，可选: certificate, resume, portfolio" },
        { status: 400 }
      );
    }

    const plan = getPlan(plan_id);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const stages = getStagesByPlan(plan_id);
    const stats = getPlanStats(plan_id);
    const exportDir = ensureExportDir(plan_id);
    const timestamp = Date.now();

    let content: string;
    let ext: string;

    switch (type) {
      case "certificate":
        content = generateCertificateHtml(plan, stages, stats);
        ext = "html";
        break;
      case "portfolio": {
        const projects = getProjectsByPlan(plan_id);
        content = generatePortfolioHtml(plan, projects);
        ext = "html";
        break;
      }
      case "resume":
        content = await generateResumeMarkdown(plan, stages, stats);
        ext = "md";
        break;
      default:
        return NextResponse.json({ error: "无效的 type" }, { status: 400 });
    }

    const fileName = `${type}_${timestamp}.${ext}`;
    const filePath = path.join(exportDir, fileName);
    fs.writeFileSync(filePath, content, "utf-8");

    createExportRecord(plan_id, type, filePath);

    return NextResponse.json({ file_path: filePath, content });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
