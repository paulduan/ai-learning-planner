# 代码架构师: 阶段检测改进

## 元信息
- **阶段**: 代码架构师
- **执行模型**: Claude 4.6 Opus
- **验证模型**: 无（快速模式）
- **状态**: ✅ 已通过
- **执行时间**: 2026-08-03T20:15:00Z
- **前置依赖**: 00-pipeline-config.md

---

## Codebase Map

### Tech Stack
- Platform: Next.js 16 (App Router) + React 19
- Backend: Next.js Route Handlers
- Database: SQLite (better-sqlite3, WAL)
- AI: Vercel AI SDK + Zod structured output

### 影响范围（Assess 模块）

| 文件 | 类型 | 职责 |
|------|------|------|
| `src/lib/ai.ts` | 核心 | LLM prompt + schema (assessLearning, regenerateAssessmentQuestions) |
| `src/app/api/stage/[id]/assess/route.ts` | API | POST 评估 / PATCH 重新出题 |
| `src/app/plan/[id]/stage/[sid]/assess/page.tsx` | UI | 答题 + 结果展示 |
| `src/db/queries.ts` | 数据 | Stage / Assessment 类型定义 |

---

## 产物内容

### ADR-1: 题目生成数据源 — 从 summary_text 改为 chat history

**背景**: 当前 `regenerateAssessmentQuestions()` 基于 `summary_text`（预生成的800字导读）出题。用户反映题目与实际学习内容关联不大。

**现状分析**:
- PATCH `/api/stage/[id]/assess` 调用 `regenerateAssessmentQuestions()`
- 传入参数: `stage_title`, `key_topics`, `learning_objectives`, `stage_description`, `summary_text`
- 没有使用 `teaching_chat` 表中的对话记录

**方案**:
- 修改 PATCH 路由: 从 `teaching_chat` 表读取该阶段的对话历史
- 修改 `regenerateAssessmentQuestions()`: 新增 `chat_history` 参数
- Prompt 策略: 优先基于对话内容出题；如对话为空，fallback 到 summary_text
- 对话过长时截取最近 30 条消息

**影响**:
- `src/app/api/stage/[id]/assess/route.ts` (PATCH handler)
- `src/lib/ai.ts` (regenerateAssessmentQuestions 函数签名 + prompt)

---

### ADR-2: 结构化题型 — assessment_questions 从 string[] 改为对象数组

**背景**: 当前 `assessment_questions` 是 `string[]`，只能存简答题文本。要支持选择题/填空题/判断题需要结构化数据。

**方案**:
- 题目数据结构:
```typescript
interface AssessmentQuestion {
  type: "choice" | "fill" | "true_false" | "short_answer";
  question: string;
  options?: string[];       // choice 专用
  correct_answer?: string;  // choice/fill/true_false 的标准答案
}
```
- DB 存储: `assessment_questions` 字段已是 JSON TEXT，无需 schema 迁移，只需改 JSON 内容格式
- LLM 生成: 修改 `regenerateAssessmentQuestions` 返回 `AssessmentQuestion[]`
- 兼容: 读取时检测旧格式 `string[]`，自动转为 `{ type: "short_answer", question: str }`

**出题规则**:
- 3-5 题混合出题
- 至少 1 道选择题、1 道简答题
- 填空题和判断题视内容适当加入
- 选择题必须有 4 个选项

**影响**:
- `src/lib/ai.ts` (schema + prompt)
- `src/app/api/stage/[id]/assess/route.ts` (PATCH 返回值)
- `src/app/plan/[id]/stage/[sid]/assess/page.tsx` (UI 渲染不同题型)
- `src/db/queries.ts` (Stage 类型定义中 assessment_questions 类型)

---

### ADR-3: 逐题评分 — 评估结果新增 per_question_results

**背景**: 当前 `assessLearning()` 将所有答案合并后给总体三维评分。用户希望每题有独立反馈。

**方案**:
- 新增返回字段:
```typescript
interface PerQuestionResult {
  question_index: number;
  question_text: string;
  is_correct: boolean;      // choice/fill/true_false 直接判对错
  score: number;            // 0-100，short_answer 用 LLM 打分
  feedback: string;         // 逐题反馈
}
```
- 客观题(choice/fill/true_false): 先在服务端做字符串匹配判对错，再由 LLM 给反馈
- 主观题(short_answer): 完全由 LLM 打分 + 反馈
- 总体三维评分保留，作为综合聚合
- `score_overall` = 各题 score 加权平均

**影响**:
- `src/lib/ai.ts` (assessmentSchema 新增 per_question_results)
- `src/app/api/stage/[id]/assess/route.ts` (POST handler)
- `src/app/plan/[id]/stage/[sid]/assess/page.tsx` (结果页展示逐题反馈)

---

### ADR-4: 推荐资料可点击 — suggestions 改为结构化对象

**背景**: 评估结果中 `suggestions: string[]` 是纯文本，无法点击跳转。

**方案**:
- 修改 `suggestions` 输出格式:
```typescript
interface Suggestion {
  title: string;         // 资料标题
  url: string;           // 链接（LLM 生成，可能不准确）
  description: string;   // 简短说明
}
```
- Prompt 要求 LLM 生成真实可访问的 URL
- 前端用 `<a href>` 渲染，添加外链图标
- 兼容旧数据: 如果读到的是 string，自动转为 `{ title: str, url: "", description: str }`

**影响**:
- `src/lib/ai.ts` (assessmentSchema 中 suggestions 类型)
- `src/app/plan/[id]/stage/[sid]/assess/page.tsx` (结果页渲染)
- `src/db/queries.ts` (Assessment 类型定义)

---

## 实现顺序

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 修改 `src/lib/ai.ts` — 新题型schema + 逐题评分schema + suggestions结构化 + chat history参数 | 无 |
| 2 | 修改 `src/app/api/stage/[id]/assess/route.ts` — PATCH读取chat history，POST传递结构化数据 | 步骤1 |
| 3 | 修改 `src/app/plan/[id]/stage/[sid]/assess/page.tsx` — 多题型UI + 逐题反馈 + 可点击资料 | 步骤1,2 |
| 4 | 修改 `src/db/queries.ts` — 类型定义更新 | 步骤1 |

## 风险点

| 风险 | 缓解 |
|------|------|
| 旧数据 assessment_questions 是 string[]，新格式是对象数组 | 读取时做兼容转换 |
| LLM 生成的 URL 可能是假的 | 前端标注"AI 推荐"，不保证链接有效；后续可接 Tavily 验证 |
| 对话历史为空时出题 | Fallback 到 summary_text |
| DeepSeek 模型不支持 generateObject | 已有 deepSeekGenerateObject fallback 机制 |
