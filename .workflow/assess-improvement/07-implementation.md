# 程序员: 阶段检测改进

## 元信息
- **阶段**: 程序员
- **执行模型**: Claude 4.6 Opus
- **状态**: ✅ 已通过
- **执行时间**: 2026-08-03T20:20:00Z
- **前置依赖**: 04-architecture.md

---

## 修改文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/lib/ai.ts` | 修改 | 新增结构化题型schema、逐题评分schema、suggestions结构化、chat_history参数 |
| `src/app/api/stage/[id]/assess/route.ts` | 修改 | PATCH读取chat history、POST支持structured_answers |
| `src/app/plan/[id]/stage/[sid]/assess/page.tsx` | 重写 | 多题型UI组件、逐题反馈展示、可点击资料链接 |
| `src/db/queries.ts` | 修改 | Assessment类型新增per_question_results、suggestions结构化 |
| `src/db/schema.ts` | 修改 | 新增assessment表per_question_results列迁移 |

## 改动详情

### 1. 题目基于对话历史生成
- `regenerateAssessmentQuestions` 新增 `chat_history` 参数
- PATCH路由从 `teaching_chat` 表读取对话记录
- 有对话时优先基于对话出题，无对话fallback到summary_text

### 2. 结构化多题型
- 新类型 `GeneratedQuestion`: `{ type, question, options?, correct_answer? }`
- 支持: choice(选择)、fill(填空)、true_false(判断)、short_answer(简答)
- 出题prompt要求4题混合: 1选择 + 1判断 + 1填空 + 1简答
- 前端 `QuestionInput` 组件根据题型渲染不同UI

### 3. 逐题评分
- 评估schema新增 `per_question_results` 数组
- 每题有 `is_correct`、`score`、`feedback`
- 结果页新增"逐题评估"卡片，每题显示对错标记和反馈
- DB新增 `per_question_results` TEXT列

### 4. 推荐资料可点击
- `suggestions` 从 `string[]` 改为 `{ title, url, description }[]`
- 前端 `normalizeSuggestion` 兼容旧string格式（自动提取URL）
- 有URL时渲染为 `<a>` 外链，无URL时显示为普通文本

## 兼容性
- ✅ 旧 `assessment_questions: string[]` 通过 `normalizeQuestion` 自动转换
- ✅ 旧 `suggestions: string[]` 通过 `normalizeSuggestion` 自动转换
- ✅ TypeScript编译零错误
- ✅ SQLite新列通过 `safeAddColumn` 安全迁移
