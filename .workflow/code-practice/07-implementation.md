# 程序员阶段: 代码练习模块

## 元信息
- **阶段**: 程序员
- **执行模型**: Claude 4.6 Opus
- **状态**: ✅ 已完成
- **执行时间**: 2026-08-10
- **前置依赖**: 无（快速原型模式）

---

## 产物内容

### 修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/ai.ts` | 修改 | 新增 `generatePlanFromCode()` 函数 |
| `src/app/api/plan/generate-from-code/route.ts` | 新增 | 代码分析 API 路由 |
| `src/app/plan/new/page.tsx` | 修改 | 新增「从代码学习」UI 入口和步骤 |

### 后端实现

#### 1. `generatePlanFromCode()` — AI 代码分析函数

位置: `src/lib/ai.ts`

- 接收参数: `code_content`(代码内容), `project_name`, `file_tree`, 学习者画像参数
- 使用与 `generatePlanFromBook` 相同的 `planSchema` 输出格式
- Prompt 设计重点:
  - 基于代码实际内容规划，引用具体文件名/函数名
  - 由浅入深: 先全局架构 → 再核心模块 → 最后高级特性
  - 检测题类型: 代码理解题、设计思考题、动手实践题
- 支持 DeepSeek 降级模式

#### 2. `/api/plan/generate-from-code` — API 路由

位置: `src/app/api/plan/generate-from-code/route.ts`

核心功能:
- **文件扫描**: 递归遍历项目目录，智能过滤
  - 忽略: `node_modules`, `.git`, `dist`, `build`, `vendor`, `__pycache__` 等 30+ 目录
  - 包含: `.js/.ts/.go/.py/.java/.rs/.cpp/.swift` 等 40+ 源码扩展名
  - 包含: `package.json/go.mod/Cargo.toml` 等配置文件
- **容量控制**: 单文件 ≤30KB，总量 ≤80K 字符，超出自动截断
- **文件树生成**: 最深 4 层，ASCII 树形结构
- **路径验证模式**: `validate_only=true` 仅验证路径有效性，不触发 AI 生成
- **计划创建**: 复用 `createPlan/createStage` 等现有 DB 函数
- **知识图谱**: 自动调用 `extractConcepts()` 生成概念图
- **阶段项目**: 自动调用 `generateStageProject()` 为第一阶段生成实践项目

#### 3. 前端「从代码学习」入口

位置: `src/app/plan/new/page.tsx`

新增内容:
- **Step type**: 新增 `"code"` 步骤
- **模板页按钮**: 「💻 从代码学习」按钮，与「📖 上传书籍」并列
- **代码输入步骤**: 项目路径输入框 + 路径验证按钮
- **路径验证**: 调用 API `validate_only` 模式确认路径有效
- **参数设置**: 复用现有 customize 步骤（研究深度、每日投入、经验水平）
- **对话问卷**: 复用现有 dialogue 步骤（学习动机、背景、期望成果）
- **生成动画**: 专属代码分析动画步骤（8 步）
- **步骤指示器**: 自动显示 code 路径的步骤点

### 数据流

```
用户输入项目路径
  → 前端验证 (validate_only API)
  → 设置学习参数
  → 对话问卷
  → POST /api/plan/generate-from-code
    → walkDir() 递归读取源码文件
    → buildFileTree() 生成文件树
    → generatePlanFromCode() AI 分析
    → createPlan() + createStage() 存 DB
    → extractConcepts() 生成知识图谱
    → generateStageProject() 生成第一阶段项目
  → 预览计划
  → 确认并开始学习
  → 进入现有的 stage/chat/assess 流程
```

---

## 设计决策

1. **不新增 DB 表**: 代码学习计划和普通计划使用相同的数据结构，区别仅在于 `goal_description` 包含项目名
2. **不修改 Chat API**: 现有的苏格拉底式 system prompt 已经足够通用，stage 的 `summary_text` 和 `key_topics` 由 AI 基于代码内容生成，自然会引导代码相关的教学
3. **路径安全**: 仅读取文件内容，不执行任何代码，不修改任何文件
4. **容量策略**: 大项目自动截断到 80K 字符，优先读取目录结构靠前的文件
