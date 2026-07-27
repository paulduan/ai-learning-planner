# 实现记录: AI Learning Planner V2 — 6大差异化功能

## 元信息
- **阶段**: 程序员
- **执行模型**: Claude 4.6 Opus
- **状态**: ✅ 已完成
- **执行时间**: 2026-07-03

---

## 实现内容

### 1. 数据层
- **schema.ts**: 新增 9 张表 (review_schedule, review_session, knowledge_concept, knowledge_relation, stage_project, learning_session, mastery_profile, adaptive_adjustment, export_record)
- **schema.ts**: 修改 learning_plan (+review_enabled, adaptive_enabled, analytics_enabled, review_interval_preset)
- **schema.ts**: 修改 system_config (+review_notifications, default_review_interval_preset)
- **queries.ts**: 新增所有表的 CRUD 函数 + analytics helpers (getPlanStats, getDailyStudyTime, getHourlyDistribution 等)

### 2. AI 层 (ai.ts)
- `extractConcepts()` — 从计划阶段中提取知识概念和关系
- `analyzeMastery()` — 分析评估表现，判断掌握水平
- `generateStageProject()` — 为阶段生成实战项目
- `generateResumeBullets()` — 生成简历描述

### 3. API 路由
| 路由 | 方法 | 功能 |
|------|------|------|
| /api/review | GET/POST | 复习列表 / 完成复习 |
| /api/review/[id]/questions | GET | AI 生成复习题 |
| /api/graph | GET/POST | 知识图谱 CRUD |
| /api/project | GET/PUT | 阶段项目管理 |
| /api/analytics | GET | 学习数据分析 |
| /api/session | POST | 学习会话开始/结束 |
| /api/adaptive | GET/POST | 自适应调整管理 |
| /api/export | GET/POST | 导出生成和历史 |

### 4. 集成
- **计划生成** (plan/generate/route.ts): 自动提取概念 + 生成第一阶段项目
- **评估完成** (stage/[id]/assess/route.ts): 自动创建掌握度画像 + 复习计划 + 下一阶段项目

### 5. UI 页面
| 页面 | 路径 | 功能 |
|------|------|------|
| 复习中心 | /review | 待复习/即将到来/已完成，复习对话框 |
| 知识图谱 | /plan/[id]/graph | ReactFlow 交互式图谱 |
| 学习洞察 | /plan/[id]/analytics | Recharts 图表仪表盘 |
| 导出中心 | /plan/[id]/export | 证书/简历/作品集生成和预览 |

### 6. 主面板增强
- 计划仪表盘新增 "实战项目" Tab
- 侧边栏新增: 复习中心(带待办数), 知识图谱, 学习洞察, 导出中心 导航

### 7. 新增依赖
- `reactflow` — 知识图谱可视化
- `recharts` — 学习数据图表

---

## 修改文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/db/schema.ts | 修改 | +9 表, +6 列 |
| src/db/queries.ts | 修改 | +300 行 CRUD 函数 |
| src/lib/ai.ts | 修改 | +4 个 AI 函数 |
| src/app/api/plan/generate/route.ts | 修改 | 集成概念提取+项目生成 |
| src/app/api/stage/[id]/assess/route.ts | 修改 | 集成掌握度分析+复习+项目 |
| src/app/plan/[id]/page.tsx | 修改 | 新增项目Tab+侧边栏导航 |
| src/app/api/review/route.ts | 新增 | 复习 API |
| src/app/api/review/[id]/questions/route.ts | 新增 | 复习题生成 API |
| src/app/api/graph/route.ts | 新增 | 知识图谱 API |
| src/app/api/project/route.ts | 新增 | 项目管理 API |
| src/app/api/analytics/route.ts | 新增 | 分析数据 API |
| src/app/api/session/route.ts | 新增 | 学习会话 API |
| src/app/api/adaptive/route.ts | 新增 | 自适应调整 API |
| src/app/api/export/route.ts | 新增 | 导出生成 API |
| src/app/review/page.tsx | 新增 | 复习中心页面 |
| src/app/plan/[id]/graph/page.tsx | 新增 | 知识图谱页面 |
| src/app/plan/[id]/analytics/page.tsx | 新增 | 学习洞察页面 |
| src/app/plan/[id]/export/page.tsx | 新增 | 导出中心页面 |
