import { getConfig, getCachedSearch, setCachedSearch } from "@/db/queries";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  source: string;
}

export interface CrawlResult {
  title: string;
  content: string;
  url: string;
  links: string[];
}

export async function searchTavily(query: string, options?: {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeAnswer?: boolean;
}): Promise<SearchResult[]> {
  const config = getConfig();
  const apiKey = config.tavily_api_key;
  if (!apiKey) {
    throw new Error("请先在设置页面配置 Tavily API Key");
  }

  const cached = getCachedSearch(query);
  if (cached) {
    return cached.results as SearchResult[];
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: options?.maxResults || 8,
      search_depth: options?.searchDepth || "basic",
      include_answer: options?.includeAnswer || false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily 搜索失败: ${err}`);
  }

  const data = await res.json();
  const results: SearchResult[] = (data.results || []).map((r: { title: string; url: string; content: string; score: number }) => ({
    title: r.title,
    url: r.url,
    content: r.content || "",
    score: r.score || 0,
    source: "tavily",
  }));

  setCachedSearch(query, results, "tavily", 24);
  return results;
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  const res = await fetch(jinaUrl, {
    headers: {
      Accept: "application/json",
      "X-Return-Format": "markdown",
    },
  });

  if (!res.ok) {
    throw new Error(`爬取失败: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json();
    return {
      title: data.data?.title || "",
      content: data.data?.content || "",
      url: data.data?.url || url,
      links: data.data?.links || [],
    };
  }

  const text = await res.text();
  return {
    title: "",
    content: text,
    url,
    links: [],
  };
}

export const DEFAULT_QUALITY_SITES = [
  { domain: "wikipedia.org", category: "百科", trust: "high" },
  { domain: "github.com", category: "代码", trust: "high" },
  { domain: "arxiv.org", category: "论文", trust: "high" },
  { domain: "zhihu.com", category: "社区", trust: "medium" },
  { domain: "stackoverflow.com", category: "技术问答", trust: "high" },
  { domain: "huggingface.co", category: "AI模型", trust: "high" },
  { domain: "deeplearning.ai", category: "课程", trust: "high" },
  { domain: "python.org", category: "官方文档", trust: "high" },
  { domain: "pytorch.org", category: "官方文档", trust: "high" },
  { domain: "tensorflow.org", category: "官方文档", trust: "high" },
  { domain: "openai.com", category: "官方文档", trust: "high" },
  { domain: "docs.anthropic.com", category: "官方文档", trust: "high" },
  { domain: "langchain.com", category: "框架文档", trust: "high" },
  { domain: "medium.com", category: "技术博客", trust: "medium" },
  { domain: "juejin.cn", category: "技术社区", trust: "medium" },
];
