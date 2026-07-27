# 程序员实现记录: 精细化AI规划

## 元信息
- **阶段**: 程序员
- **执行模型**: Claude 4.6 Opus
- **状态**: ✅ 已完成
- **执行时间**: 2026-07-02
- **前置依赖**: 01-requirements.md, 02-ceo-review.md, 03-design-review.md

---

## 技术栈

| 层级 | 选择 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.2 |
| UI | shadcn/ui + Tailwind CSS | v4 |
| 数据库 | SQLite (better-sqlite3) | - |
| AI SDK | Vercel AI SDK + Zod | - |
| LLM 支持 | OpenAI + Anthropic | - |

## 项目结构

```
ai-learning-planner/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 首页
│   │   ├── layout.tsx                  # 全局布局 (dark mode)
│   │   ├── settings/page.tsx           # 设置页
│   │   ├── plan/
│   │   │   ├── new/page.tsx            # 创建计划页
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # 关卡地图页
│   │   │       └── stage/[sid]/
│   │   │           ├── page.tsx        # 阶段学习页
│   │   │           └── assess/page.tsx # 检测页
│   │   └── api/
│   │       ├── config/route.ts         # 配置 CRUD
│   │       ├── config/test/route.ts    # 连接测试
│   │       ├── plan/route.ts           # 获取计划
│   │       ├── plan/generate/route.ts  # AI 生成计划
│   │       ├── stage/[id]/
│   │       │   ├── resources/route.ts  # 资料管理
│   │       │   └── assess/route.ts     # 检测评估
│   │       └── resource/[id]/toggle/route.ts # 资料完成切换
│   ├── db/
│   │   ├── schema.ts                   # 数据库初始化 & migration
│   │   └── queries.ts                  # 数据查询层
│   ├── lib/
│   │   └── ai.ts                       # AI 集成 (规划/评估/资源推荐)
│   └── config/
│       └── templates.ts                # 3 个预设学习模板
├── data/                               # SQLite 数据文件 (gitignored)
└── next.config.ts
```

## 已实现功能

### Sprint 0 - 基础设施
- [x] Next.js 项目初始化 + shadcn/ui
- [x] SQLite 数据库自动初始化 + WAL 模式
- [x] 6 张数据表: system_config, learning_plan, stage, resource, assessment
- [x] 设置页: LLM Provider 选择、API Key 加密存储、模型选择
- [x] 代理配置: HTTP/SOCKS5 代理、端口配置
- [x] 连接测试 API

### Sprint 1 - 规划生成
- [x] 3 个预设模板: AI应用开发岗、Prompt Engineering、LLM微调实战
- [x] 自定义目标输入
- [x] 计划参数: 周期(4/6/8周)、每日时长(0.5-8h)、水平(3档)
- [x] AI 生成计划 (Structured Output + Zod Schema)
- [x] 规划预览 + 确认/重新生成
- [x] 闯关状态机: locked → active → completed
- [x] 关卡地图页: 阶段列表、进度条、状态图标

### Sprint 2 - 内容与检测
- [x] AI 推荐学习资料 (5-8 条/阶段)
- [x] 资料类型标签: 文章/视频/文档/书籍/代码/论文
- [x] 国内/海外标签 + 需代理提示
- [x] 资料完成勾选 + 进度计算
- [x] 文字检测: 200 字最低要求、字数实时统计
- [x] AI 三维评分: 知识覆盖度/理解深度/表达准确性
- [x] 通过标准: 综合分 ≥ 70 且覆盖度 ≥ 80%
- [x] 失败反馈: 缺失知识点 + 推荐资料(不给答案)
- [x] 通过后自动解锁下一阶段 + 生成资料
- [x] 计划完成检测

## 产品决策实现

| 决策 | 实现方式 |
|------|---------|
| 不允许跳过/强制解锁 | 无 skip 按钮，locked 阶段不可点击 |
| 失败不给答案 | AI prompt 明确要求不给答案，仅推荐参考资料 |
| API Key 必须配置 | 首页检测 config，无 Key 跳转设置页 |
| VPN/代理支持 | 设置页代理配置，资料标注 region_tag |

## 启动方式

```bash
cd ai-learning-planner
npm install
npm run dev
# 访问 http://localhost:3000
```
