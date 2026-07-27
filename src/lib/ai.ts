import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getConfig } from "@/db/queries";

function isDeepSeek() {
  return getConfig().llm_provider === "deepseek";
}

function getModel() {
  const config = getConfig();
  if (!config.llm_api_key) {
    throw new Error("请先在设置页面配置 API Key");
  }

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

function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(text.slice(braceStart, braceEnd + 1));
  }
  return JSON.parse(text);
}

async function deepSeekGenerateObject<T>(prompt: string, schemaDescription: string): Promise<T> {
  const model = getModel();
  const { text } = await generateText({
    model,
    prompt: `${prompt}\n\n请严格按照以下 JSON 格式输出，不要输出任何其他内容：\n${schemaDescription}`,
  });
  return extractJson(text) as T;
}

const planSchema = z.object({
  plan_title: z.string(),
  stages: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      key_topics: z.array(z.string()),
      estimated_days: z.number(),
      learning_objectives: z.array(z.string()),
      summary_text: z.string().describe("800字左右的学习导读，包含核心概念和学习顺序建议"),
      core_output: z.string().describe("完成本阶段后的具体产出物，如'搭建完成一个能跑通的chatbot demo'"),
      real_world_cases: z.array(z.string()).describe("1-2个现实案例，说明这个技术在真实世界中如何被使用"),
      assessment_questions: z.array(z.string()).describe("3-5个苏格拉底式思考题，用来检验学习成果"),
    })
  ),
});

export type GeneratedPlan = z.infer<typeof planSchema>;

const PLAN_SCHEMA_DESC = `{
  "plan_title": "计划标题",
  "stages": [
    {
      "title": "阶段标题",
      "description": "阶段描述",
      "key_topics": ["知识点1", "知识点2"],
      "estimated_days": 7,
      "learning_objectives": ["目标1", "目标2"],
      "summary_text": "800字左右的学习导读",
      "core_output": "完成本阶段后你会做出什么，如'一个能运行的API调用demo'",
      "real_world_cases": ["案例1: 某公司如何用此技术解决X问题", "案例2: ..."],
      "assessment_questions": ["为什么X要这样设计？", "如果遇到Y情况你会怎么处理？", "请解释Z的工作原理"]
    }
  ]
}`;

export async function generatePlan(params: {
  goal: string;
  duration_weeks: number;
  daily_hours: number;
  skill_level: string;
  motivation?: string;
  background?: string;
  expected_outcome?: string;
  constraints?: string[];
}): Promise<GeneratedPlan> {
  const levelMap: Record<string, string> = {
    beginner: "零基础入门",
    intermediate: "有一定基础",
    advanced: "有经验想进阶",
  };

  const contextBlock = [
    params.motivation ? `学习动机: ${params.motivation}` : "",
    params.background ? `当前背景: ${params.background}` : "",
    params.expected_outcome ? `期望成果: ${params.expected_outcome}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `你是一位全能学习规划师。你可以为任何领域制定学习计划（技术、投资、商业、语言、艺术、人文等）。

## 第一步：判断学习类型

根据学习目标，判断属于以下哪种类型，并采用对应的教学策略：

**类型A - 操作上手型**（如学编程、学做菜、学乐器、学设计）
→ 策略：先动手做出东西 → 遇到问题再学理论 → 边做边学
→ 第一阶段：让学习者直接上手完成一个最小可用的作品

**类型B - 知识链路型**（如行业研究、投资分析、历史研究、学科理论）
→ 策略：先建立全局地图 → 逐个维度深入 → 形成完整认知框架
→ 第一阶段：鸟瞰全局，理解这个领域的完整链路（起源 → 发展 → 现状 → 趋势）
→ 知识链路必须覆盖：历史演化、核心参与者、产业链/知识结构、经济/数据维度、竞争/对比分析、未来趋势

**类型C - 混合型**（如产品经理、数据分析、商务英语）
→ 策略：理论和实践交替进行

## 教学理念
- **连接现实**：所有知识都和真实场景挂钩，学习者随时感受到"我学的这个有什么用"
- **苏格拉底式引导**：通过提问激发思考，而不是灌输知识
- **以学习者的真实动机为中心**：围绕用户最终想达成的目标来规划

请根据以下信息生成一个详细的学习计划。

## 学习者画像
学习目标: ${params.goal}
计划周期: ${params.duration_weeks} 周
每日可用学习时间: ${params.daily_hours} 小时
当前水平: ${levelMap[params.skill_level] || params.skill_level}
${contextBlock}
${params.constraints?.length ? `额外要求: ${params.constraints.join("、")}` : ""}

## 核心要求
1. 首先判断学习类型（A/B/C），然后采用对应策略
2. 将学习计划拆分为 4-6 个阶段，每个阶段有明确的主题和目标
3. 阶段之间循序渐进，前一阶段是后一阶段的基础
4. 根据每日可用时间合理分配每个阶段的天数，总天数 = ${params.duration_weeks * 7} 天
5. 每个阶段的核心知识点（key_topics）列出 3-6 个
6. 每个阶段的学习目标（learning_objectives）列出 2-4 个可验证的目标
7. 每个阶段写一段 800 字左右的学习导读（summary_text），包含核心概念解释和推荐的学习顺序
8. 每个阶段的 core_output 描述完成后的具体产出物：
   - 操作型：做出了什么（如"一个能运行的demo"）
   - 知识型：产出了什么（如"一份存储行业产业链分析笔记"或"一张竞争格局地图"）
9. 每个阶段提供 1-2 个 real_world_cases（真实世界中的案例）
10. 每个阶段设计 3-5 个 assessment_questions（思考题），用来检验本阶段的学习成果:
    - 【极其重要】检测题必须且只能考察本阶段的 key_topics 内容，绝对不能提前考察后续阶段的知识点！
    - 检测题的核心逻辑：学生只学了本阶段内容就应该能答出来
    - 类型包含: 为什么（原理）、怎么做（分析/实操）、如果...会怎样（推理）
    - 问题要有深度，不能是简单的定义复述
    - 错误示例：阶段2讲"基础Prompt"，检测题却问"Chain-of-Thought"（这是阶段3的内容）
11. 如果学习者有明确的动机（如找工作、投资赚钱、考试），优先安排与该目标最相关的内容`;

  if (isDeepSeek()) {
    return deepSeekGenerateObject<GeneratedPlan>(prompt, PLAN_SCHEMA_DESC);
  }

  const model = getModel();
  const { object } = await generateObject({
    model,
    schema: planSchema,
    prompt,
  });
  return object;
}

export async function generatePlanFromBook(params: {
  book_content: string;
  book_title?: string;
  duration_weeks: number;
  daily_hours: number;
  skill_level: string;
  motivation?: string;
  background?: string;
  expected_outcome?: string;
}): Promise<GeneratedPlan> {
  const levelMap: Record<string, string> = {
    beginner: "零基础入门",
    intermediate: "有一定基础",
    advanced: "有经验想进阶",
  };

  const contextBlock = [
    params.motivation ? `学习动机: ${params.motivation}` : "",
    params.background ? `当前背景: ${params.background}` : "",
    params.expected_outcome ? `期望成果: ${params.expected_outcome}` : "",
  ].filter(Boolean).join("\n");

  const bookContentTruncated = params.book_content.length > 50000
    ? params.book_content.slice(0, 50000) + "\n\n[... 内容过长已截断 ...]"
    : params.book_content;

  const prompt = `你是一位学习规划师。用户上传了一本书，请你基于这本书的实际内容，制定一个阶段化的学习计划。

## 书籍信息
${params.book_title ? `书名: ${params.book_title}` : ""}

### 书籍内容
${bookContentTruncated}

## 学习者画像
计划周期: ${params.duration_weeks} 周
每日可用学习时间: ${params.daily_hours} 小时
当前水平: ${levelMap[params.skill_level] || params.skill_level}
${contextBlock}

## 核心要求
1. **基于书的实际内容来规划**：阶段划分必须对应书中的实际章节/内容，不要凭空添加书中没有的内容
2. 将整本书拆分为 4-6 个学习阶段，每个阶段覆盖书中的某几个章节或主题
3. 阶段之间循序渐进，按照书的逻辑顺序安排
4. 根据每日可用时间合理分配每个阶段的天数，总天数 = ${params.duration_weeks * 7} 天
5. 每个阶段的核心知识点（key_topics）必须来自书中实际讲述的概念，列出 3-6 个
6. 每个阶段的学习目标（learning_objectives）列出 2-4 个可验证的目标
7. 每个阶段写一段 800 字左右的学习导读（summary_text）：
   - 必须基于书中的实际内容来写，用你自己的语言解读书中的核心观点
   - 包含这部分内容的核心概念、逻辑关系、和学习要点
   - 帮助学习者在阅读前建立框架，阅读后加深理解
8. 每个阶段的 core_output 描述学完后的具体产出（如"用自己的话总结XX理论并给出一个应用案例"）
9. 每个阶段提供 1-2 个 real_world_cases（书中提到的案例 或 基于书的内容联想的现实案例）
10. 每个阶段设计 3 个 assessment_questions（思考题）：
    - 题目必须基于书中这部分内容来出，学完对应章节就能回答
    - 类型：一道"为什么"（理解作者的论点），一道"怎么用"（应用层面），一道"如果…会怎样"（延伸思考）
    - 不能出超出对应阶段书本内容的题`;

  if (isDeepSeek()) {
    return deepSeekGenerateObject<GeneratedPlan>(prompt, PLAN_SCHEMA_DESC);
  }

  const model = getModel();
  const { object } = await generateObject({
    model,
    schema: planSchema,
    prompt,
  });
  return object;
}

const assessmentSchema = z.object({
  score_overall: z.number().min(0).max(100),
  score_coverage: z.number().min(0).max(100).describe("知识覆盖度"),
  score_depth: z.number().min(0).max(100).describe("理解深度"),
  score_accuracy: z.number().min(0).max(100).describe("表达准确性"),
  passed: z.boolean(),
  missing_topics: z.array(z.string()).describe("未覆盖或理解不足的知识点"),
  feedback: z.string().describe("详细反馈，说明优点和不足，但不直接给出答案"),
  suggestions: z.array(z.string()).describe("改进建议，推荐具体的论文/文章/链接帮助学习"),
});

export type AssessmentResult = z.infer<typeof assessmentSchema>;

const ASSESS_SCHEMA_DESC = `{
  "score_overall": 75,
  "score_coverage": 80,
  "score_depth": 70,
  "score_accuracy": 75,
  "passed": true,
  "missing_topics": ["未覆盖的知识点"],
  "feedback": "详细评估反馈文字",
  "suggestions": ["推荐的论文/文章/链接"]
}`;

export async function assessLearning(params: {
  stage_title: string;
  key_topics: string[];
  learning_objectives: string[];
  user_input: string;
  questions?: string[];
  answers?: { question: string; answer: string }[];
}): Promise<AssessmentResult> {
  const answerBlock = params.answers?.length
    ? params.answers.map((a, i) => `问题${i + 1}: ${a.question}\n回答: ${a.answer}`).join("\n\n")
    : params.user_input;

  const prompt = `你是一位严格但公正的学习评估专家。请评估以下学习者的阶段性学习成果。

## 阶段信息
- 阶段名称: ${params.stage_title}
- 核心知识点: ${params.key_topics.join("、")}
- 学习目标: ${params.learning_objectives.join("；")}

## 学习者的回答
${answerBlock}

## 评估要求
1. 从三个维度评分（0-100）:
   - 知识覆盖度（score_coverage）: 是否涵盖了核心知识点
   - 理解深度（score_depth）: 是否真正理解而非表面复述
   - 表达准确性（score_accuracy）: 技术术语使用是否准确
2. 综合评分 = 覆盖度 × 0.4 + 深度 × 0.35 + 准确性 × 0.25
3. 通过标准: 综合分 ≥ 70 且覆盖度 ≥ 80%
4. 如果发现学习者直接复制粘贴资料原文，降低深度分
5. feedback 中说明不足之处，但【绝对不要直接给出答案】
6. suggestions 中推荐具体的学习资料（论文名、文章标题、文档链接等），帮助学习者自行弥补不足
7. missing_topics 列出未覆盖或理解不足的知识点`;

  if (isDeepSeek()) {
    return deepSeekGenerateObject<AssessmentResult>(prompt, ASSESS_SCHEMA_DESC);
  }

  const model = getModel();
  const { object } = await generateObject({
    model,
    schema: assessmentSchema,
    prompt,
  });
  return object;
}

const RESOURCE_SCHEMA_DESC = `{
  "resources": [
    {
      "title": "资源标题",
      "url": "https://example.com",
      "source": "来源网站",
      "type": "article",
      "reason": "推荐理由（100字内）",
      "estimated_minutes": 30,
      "region_tag": "domestic"
    }
  ]
}
type 可选值: article, video, doc, book, repo, paper
region_tag 可选值: domestic, overseas`;

export async function generateResources(params: {
  stage_title: string;
  key_topics: string[];
  goal: string;
  skill_level: string;
}) {
  const resourceSchema = z.object({
    resources: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        source: z.string(),
        type: z.enum(["article", "video", "doc", "book", "repo", "paper"]),
        reason: z.string().max(100),
        estimated_minutes: z.number(),
        region_tag: z.enum(["domestic", "overseas"]),
      })
    ),
  });

  const prompt = `你是一位学习资源推荐专家。请为以下学习阶段推荐 5-8 条最权威的学习资源。

## 阶段信息
- 学习目标: ${params.goal}
- 阶段: ${params.stage_title}
- 核心知识点: ${params.key_topics.join("、")}
- 学习者水平: ${params.skill_level}

## 推荐要求
1. 覆盖国内和国外资源，标注 region_tag
2. 资源类型多样：至少包含文章、视频中的 2 种
3. **实操类资源优先**：优先推荐可以动手练习的教程和案例
4. 根据学习领域推荐对应的权威来源（如技术领域推荐官方文档和GitHub，投资领域推荐研报和数据平台，语言学习推荐课程和练习平台等）
5. URL 必须是真实可访问的链接
6. 每条资源给出推荐理由（≤100字）和预估学习时长
7. 国内资源标记为 domestic，国外资源标记为 overseas`;

  if (isDeepSeek()) {
    const result = await deepSeekGenerateObject<{ resources: z.infer<typeof resourceSchema>["resources"] }>(prompt, RESOURCE_SCHEMA_DESC);
    return result.resources;
  }

  const model = getModel();
  const { object } = await generateObject({
    model,
    schema: resourceSchema,
    prompt,
  });
  return object.resources;
}

// ==================== Knowledge Concept Extraction ====================

const CONCEPT_SCHEMA_DESC = `{
  "concepts": [
    {
      "name": "概念名称",
      "definition": "简短定义（1-2句话）",
      "stage_index": 0
    }
  ],
  "relations": [
    {
      "from": "概念A名称",
      "to": "概念B名称",
      "type": "prerequisite"
    }
  ]
}
type 可选值: prerequisite（前置依赖）, contains（包含）, related（相关）, applied_in（应用于）`;

export async function extractConcepts(params: {
  plan_title: string;
  stages: { title: string; key_topics: string[]; learning_objectives: string[]; order_index: number }[];
}): Promise<{
  concepts: { name: string; definition: string; stage_index: number }[];
  relations: { from: string; to: string; type: string }[];
}> {
  const stageInfo = params.stages.map(s =>
    `阶段${s.order_index + 1}: ${s.title}\n  知识点: ${s.key_topics.join("、")}\n  目标: ${s.learning_objectives.join("；")}`
  ).join("\n\n");

  const prompt = `你是一位知识架构师。请从以下学习计划中提取核心概念节点和概念间关系，用于构建知识图谱。

## 学习计划: ${params.plan_title}

${stageInfo}

## 要求
1. 从每个阶段的知识点和学习目标中提取 3-8 个核心概念
2. 去重：如果同一概念在多个阶段出现，只保留一次，stage_index 设为最早出现的阶段
3. 每个概念给出简短定义（1-2句话），让学习者快速理解
4. 识别概念间的关系：
   - prerequisite: A 是学习 B 的前置条件
   - contains: A 包含 B
   - related: A 和 B 相关但无前后依赖
   - applied_in: A 被应用在 B 中
5. 关系要有实际意义，不要为了凑数
6. 概念名称保持简洁（2-6个字）`;

  if (isDeepSeek()) {
    return deepSeekGenerateObject(prompt, CONCEPT_SCHEMA_DESC);
  }

  const conceptSchema = z.object({
    concepts: z.array(z.object({
      name: z.string(),
      definition: z.string(),
      stage_index: z.number(),
    })),
    relations: z.array(z.object({
      from: z.string(),
      to: z.string(),
      type: z.enum(["prerequisite", "contains", "related", "applied_in"]),
    })),
  });

  const model = getModel();
  const { object } = await generateObject({ model, schema: conceptSchema, prompt });
  return object;
}

// ==================== Mastery Level Analysis ====================

const MASTERY_SCHEMA_DESC = `{
  "overall_level": "on_track",
  "weak_topics": ["薄弱知识点1", "薄弱知识点2"],
  "analysis": "一段简短分析",
  "recommended_actions": ["建议1", "建议2"]
}
overall_level 可选值: struggling（困难）, on_track（正常）, advanced（优秀）`;

export async function regenerateAssessmentQuestions(params: {
  stage_title: string;
  key_topics: string[];
  learning_objectives: string[];
  stage_description: string;
  summary_text?: string;
}): Promise<string[]> {
  const summaryBlock = params.summary_text
    ? `\n## 本阶段学习导读内容（学生实际学习的材料）\n${params.summary_text}\n`
    : "";

  const prompt = `你是一位学习评估设计专家。请为以下学习阶段设计 3 道思考题。

## 阶段信息
- 阶段名称: ${params.stage_title}
- 阶段描述: ${params.stage_description}
- 核心知识点: ${params.key_topics.join("、")}
- 学习目标: ${params.learning_objectives.join("；")}
${summaryBlock}
## 出题规则（必须严格遵守）
1. 【最重要】题目的考察范围和深度必须严格匹配"学习导读内容"中实际教授的程度：
   - 导读中用 1-2 句话提及的概念 → 只能出"是什么/有什么用"层面的题，不能问原理
   - 导读中用一段话详细讲解的概念 → 可以出理解和应用层面的题
   - 导读中有完整实操步骤的概念 → 可以出综合实践题
2. 绝对不能出学生仅凭导读内容答不出来的题——如果回答需要额外查资料，说明题目超纲
3. 禁止出需要了解"底层实现原理"、"源码级机制"、"论文级理论"才能回答的题（除非导读明确讲了这些）
4. 题目要有深度但不超纲：考察的是学生对导读内容的消化程度，而非对该话题的全面理解
5. 类型组合：一道"为什么这样做"（基于导读中的解释）、一道"动手实操"（基于导读中的实战环节）、一道"如果改变参数/条件会怎样"（基于导读中提到的对比）
6. 优先围绕导读中的核心实战案例出题（如导读提到"构建简历信息提取工具"，就围绕这个出题）

请返回一个 JSON 数组，包含 3 个字符串（题目文本）。只返回 JSON 数组，不要其他文字。`;

  if (isDeepSeek()) {
    const result = await deepSeekGenerateObject<string[]>(prompt, '["题目1", "题目2", "题目3"]');
    return result;
  }

  const model = getModel();
  const { object } = await generateObject({
    model,
    schema: z.array(z.string()),
    prompt,
  });
  return object;
}

export async function analyzeMastery(params: {
  stage_title: string;
  key_topics: string[];
  score_overall: number;
  score_coverage: number;
  score_depth: number;
  missing_topics: string[];
  attempt_number: number;
  previous_levels?: string[];
}): Promise<{
  overall_level: string;
  weak_topics: string[];
  analysis: string;
  recommended_actions: string[];
}> {
  const prompt = `你是一位学习诊断专家。根据以下评估数据判断学习者的掌握水平。

## 评估结果
- 阶段: ${params.stage_title}
- 知识点: ${params.key_topics.join("、")}
- 综合分: ${params.score_overall}
- 覆盖度: ${params.score_coverage}
- 深度: ${params.score_depth}
- 未掌握知识点: ${params.missing_topics.join("、") || "无"}
- 第 ${params.attempt_number} 次尝试
${params.previous_levels?.length ? `- 历史表现: ${params.previous_levels.join(" → ")}` : ""}

## 判断标准
- struggling: 综合分 < 60，或覆盖度 < 50%，或多次尝试仍不通过
- on_track: 综合分 60-85，覆盖度 ≥ 80%
- advanced: 综合分 > 85，覆盖度和深度都 ≥ 85%

## 输出
1. overall_level: 掌握水平
2. weak_topics: 需要重点补强的知识点
3. analysis: 简短分析（2-3句话）
4. recommended_actions: 2-3个具体建议`;

  if (isDeepSeek()) {
    return deepSeekGenerateObject(prompt, MASTERY_SCHEMA_DESC);
  }

  const masterySchema = z.object({
    overall_level: z.enum(["struggling", "on_track", "advanced"]),
    weak_topics: z.array(z.string()),
    analysis: z.string(),
    recommended_actions: z.array(z.string()),
  });

  const model = getModel();
  const { object } = await generateObject({ model, schema: masterySchema, prompt });
  return object;
}

// ==================== Stage Project Generation ====================

const PROJECT_SCHEMA_DESC = `{
  "title": "项目标题",
  "description": "项目描述（100-200字）",
  "expected_output": "预期产出物描述",
  "checklist": [
    { "item": "步骤1描述", "completed": false },
    { "item": "步骤2描述", "completed": false }
  ],
  "difficulty": "medium",
  "estimated_minutes": 60
}
difficulty 可选值: easy, medium, hard`;

export async function generateStageProject(params: {
  stage_title: string;
  key_topics: string[];
  core_output: string;
  real_world_cases: string[];
  goal: string;
  skill_level: string;
}): Promise<{
  title: string;
  description: string;
  expected_output: string;
  checklist: { item: string; completed: boolean }[];
  difficulty: string;
  estimated_minutes: number;
}> {
  const prompt = `你是一位实战教练。请为以下学习阶段设计一个可动手完成的实战小项目。

## 阶段信息
- 阶段: ${params.stage_title}
- 知识点: ${params.key_topics.join("、")}
- 阶段产出: ${params.core_output}
- 真实案例: ${params.real_world_cases.join("；")}
- 总学习目标: ${params.goal}
- 学习者水平: ${params.skill_level}

## 设计原则
1. 项目必须可以在 30-120 分钟内完成
2. 项目产出物是具体可见的（代码、文档、分析报告、设计稿等，根据学科类型决定）
3. checklist 拆分为 4-8 个步骤，每步可独立完成和验证
4. 与真实场景挂钩，学完后能直接用于实际工作/生活
5. 难度匹配学习者水平：
   - beginner: 按步骤走就能完成
   - intermediate: 需要一定思考和查资料
   - advanced: 需要综合多个知识点解决问题`;

  if (isDeepSeek()) {
    return deepSeekGenerateObject(prompt, PROJECT_SCHEMA_DESC);
  }

  const projectSchema = z.object({
    title: z.string(),
    description: z.string(),
    expected_output: z.string(),
    checklist: z.array(z.object({ item: z.string(), completed: z.boolean() })),
    difficulty: z.enum(["easy", "medium", "hard"]),
    estimated_minutes: z.number(),
  });

  const model = getModel();
  const { object } = await generateObject({ model, schema: projectSchema, prompt });
  return object;
}

// ==================== Resume Generation ====================

export async function generateResumeBullets(params: {
  plan_title: string;
  goal: string;
  stages_completed: number;
  total_stages: number;
  study_hours: number;
  key_skills: string[];
  projects: { title: string; output: string }[];
  motivation?: string;
}): Promise<string> {
  const projectInfo = params.projects.length > 0
    ? params.projects.map(p => `- ${p.title}: ${p.output}`).join("\n")
    : "暂无已完成项目";

  const prompt = `你是一位简历优化专家。请根据以下学习经历生成适合简历的描述。

## 学习经历
- 学习主题: ${params.plan_title}
- 目标: ${params.goal}
- 完成进度: ${params.stages_completed}/${params.total_stages} 阶段
- 累计学习: ${params.study_hours} 小时
- 核心技能: ${params.key_skills.join("、")}
${params.motivation ? `- 学习动机: ${params.motivation}` : ""}

## 项目成果
${projectInfo}

## 要求
1. 生成 2-3 段 STAR 格式的简历描述（中文）
2. 强调实际产出和技能掌握
3. 用量化数据（时长、阶段数、项目数）增强说服力
4. 如果是非职业类学习（兴趣、个人成长），改为个人成长描述风格
5. 直接输出纯文本，不要 JSON 包装`;

  const model = getModel();
  const { text } = await generateText({ model, prompt });
  return text;
}

export async function generateStageSummary(params: {
  stage_title: string;
  key_topics: string[];
  learning_objectives: string[];
  chat_history: { role: string; content: string }[];
  user_notes?: string;
}): Promise<string> {
  const chatSnippet = params.chat_history
    .filter((m) => m.content !== "开始学习")
    .slice(-24)
    .map((m) => `${m.role === "user" ? "学员" : "AI"}: ${m.content}`)
    .join("\n\n");

  const prompt = `你是一位学习笔记助手。请根据以下阶段学习内容，生成一份结构化的阶段学习笔记。

## 阶段: ${params.stage_title}
## 知识点: ${params.key_topics.join("、")}
## 学习目标: ${params.learning_objectives.join("；")}

## 对话记录摘录
${chatSnippet || "（暂无对话）"}

${params.user_notes ? `## 学员已有笔记\n${params.user_notes}` : ""}

## 要求
1. 用 Markdown 格式输出
2. 包含：核心概念总结、关键收获、待深入问题、下一步行动
3. 简洁实用，控制在 800 字以内
4. 基于实际对话内容，不要编造`;

  const model = getModel();
  const { text } = await generateText({ model, prompt });
  return text;
}
