export interface PlanTemplate {
  id: string;
  title: string;
  description: string;
  goal: string;
  recommended_weeks: number;
  recommended_hours: number;
  tags: string[];
  icon: string;
  category: string;
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "ai-app-dev",
    title: "AI 应用开发",
    description: "从零到一掌握 AI 应用开发全栈能力，涵盖 Prompt Engineering、RAG、Agent",
    goal: "AI 应用开发岗位技能学习，重点掌握 Prompt Engineering、RAG、AI Agent 开发、LLM API 调用",
    recommended_weeks: 6,
    recommended_hours: 2,
    tags: ["AI", "LLM", "RAG"],
    icon: "🤖",
    category: "技术",
  },
  {
    id: "invest-stock",
    title: "股票投资入门",
    description: "系统学习股票投资基础，从看懂财报到建立自己的投资体系",
    goal: "股票投资系统学习，包括基本面分析、技术面分析、财务报表解读、行业研究方法、风险管理、投资心理学",
    recommended_weeks: 8,
    recommended_hours: 1.5,
    tags: ["投资", "股票", "财报"],
    icon: "📈",
    category: "投资",
  },
  {
    id: "invest-industry",
    title: "行业深度研究",
    description: "学会像分析师一样研究一个行业 — 产业链、竞争格局、估值逻辑",
    goal: "行业研究方法论学习，包括产业链分析、市场规模测算、竞争格局分析、公司估值方法、行业发展趋势判断",
    recommended_weeks: 6,
    recommended_hours: 2,
    tags: ["行业研究", "产业链", "估值"],
    icon: "🔍",
    category: "投资",
  },
  {
    id: "english-business",
    title: "商务英语",
    description: "提升职场英语能力 — 邮件、会议、演讲、谈判",
    goal: "商务英语系统提升，包括商务邮件写作、会议沟通、英文演示、跨文化沟通技巧、行业专业术语",
    recommended_weeks: 8,
    recommended_hours: 1,
    tags: ["英语", "商务", "沟通"],
    icon: "🌐",
    category: "语言",
  },
  {
    id: "product-manager",
    title: "产品经理入门",
    description: "从用户需求到产品上线 — 掌握产品经理核心技能树",
    goal: "产品经理核心技能学习，包括需求分析、用户研究、产品设计、数据分析、项目管理、商业模式",
    recommended_weeks: 6,
    recommended_hours: 2,
    tags: ["产品", "需求", "数据"],
    icon: "📦",
    category: "商业",
  },
  {
    id: "psychology",
    title: "心理学基础",
    description: "了解人类行为背后的心理机制 — 认知、情绪、社会心理学",
    goal: "心理学基础系统学习，包括认知心理学、社会心理学、发展心理学、情绪与动机、心理学研究方法、生活应用",
    recommended_weeks: 6,
    recommended_hours: 1,
    tags: ["心理学", "认知", "行为"],
    icon: "🧠",
    category: "人文",
  },
  {
    id: "data-analysis",
    title: "数据分析",
    description: "用数据说话 — Excel、SQL、Python 数据分析全流程",
    goal: "数据分析技能学习，包括 Excel 高级功能、SQL 查询、Python 数据处理、数据可视化、统计分析方法、业务洞察能力",
    recommended_weeks: 6,
    recommended_hours: 2,
    tags: ["数据", "SQL", "Python"],
    icon: "📊",
    category: "技术",
  },
  {
    id: "writing",
    title: "写作能力提升",
    description: "提升文字表达能力 — 从日常写作到专业内容创作",
    goal: "写作能力系统提升，包括结构化写作方法、故事叙述技巧、说服力写作、不同场景写作（报告/文案/公众号）、修改与润色技巧",
    recommended_weeks: 4,
    recommended_hours: 1,
    tags: ["写作", "表达", "内容"],
    icon: "✍️",
    category: "通用",
  },
];
