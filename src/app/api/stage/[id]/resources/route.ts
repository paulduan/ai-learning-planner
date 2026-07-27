import { NextResponse } from "next/server";
import { getResourcesByStage, getStage, createResource, getConfig, getPlan } from "@/db/queries";
import { generateResources } from "@/lib/ai";
import { searchTavily } from "@/lib/datasource";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resources = getResourcesByStage(id);
  return NextResponse.json(resources);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stage = getStage(id);
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const plan = getPlan(stage.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const config = getConfig();
  const useTavily = !!config.tavily_api_key;

  try {
    if (useTavily) {
      return await generateResourcesWithSearch(id, stage, plan);
    }
    return await generateResourcesWithLlm(id, stage, plan);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function generateResourcesWithSearch(
  stageId: string,
  stage: { title: string; key_topics: string[]; description: string },
  plan: { goal_description: string; skill_level: string }
) {
  const queries = [
    `${stage.title} 教程 学习资源`,
    `${stage.key_topics.slice(0, 3).join(" ")} tutorial guide`,
    `${plan.goal_description} ${stage.title} 最佳实践`,
  ];

  const allResults: { title: string; url: string; content: string; score: number }[] = [];

  for (const query of queries) {
    try {
      const results = await searchTavily(query, { maxResults: 5 });
      allResults.push(...results);
    } catch {
      // skip failed queries
    }
  }

  const seen = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    const domain = new URL(r.url).hostname;
    if (seen.has(domain + r.title)) return false;
    seen.add(domain + r.title);
    return true;
  });

  const typeMap: Record<string, string> = {
    "github.com": "repo",
    "arxiv.org": "paper",
    "youtube.com": "video",
    "bilibili.com": "video",
    "medium.com": "article",
    "zhihu.com": "article",
    "juejin.cn": "article",
    "stackoverflow.com": "article",
  };

  const created = [];
  const sorted = uniqueResults.sort((a, b) => b.score - a.score).slice(0, 8);

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    let hostname = "";
    try { hostname = new URL(r.url).hostname; } catch { /* ignore */ }

    const isOverseas = !hostname.endsWith(".cn") && !hostname.endsWith(".com.cn");
    const type = Object.entries(typeMap).find(([domain]) => hostname.includes(domain))?.[1] || "article";

    const resourceId = createResource({
      stage_id: stageId,
      title: r.title,
      url: r.url,
      source: hostname,
      type,
      reason: r.content.slice(0, 100),
      estimated_minutes: 30,
      region_tag: isOverseas ? "overseas" : "domestic",
      sort_order: i,
      search_source: "tavily",
      verified: true,
    });

    created.push({
      id: resourceId,
      title: r.title,
      url: r.url,
      source: hostname,
      type,
      reason: r.content.slice(0, 100),
      estimated_minutes: 30,
      region_tag: isOverseas ? "overseas" : "domestic",
      search_source: "tavily",
      verified: true,
    });
  }

  return NextResponse.json(created);
}

async function generateResourcesWithLlm(
  stageId: string,
  stage: { title: string; key_topics: string[] },
  plan: { goal_description: string; skill_level: string }
) {
  const resources = await generateResources({
    stage_title: stage.title,
    key_topics: stage.key_topics,
    goal: plan.goal_description,
    skill_level: plan.skill_level,
  });

  const created = [];
  for (let i = 0; i < resources.length; i++) {
    const resourceId = createResource({
      stage_id: stageId,
      title: resources[i].title,
      url: resources[i].url,
      source: resources[i].source,
      type: resources[i].type,
      reason: resources[i].reason,
      estimated_minutes: resources[i].estimated_minutes,
      region_tag: resources[i].region_tag,
      sort_order: i,
      search_source: "llm",
      verified: false,
    });
    created.push({ id: resourceId, ...resources[i], search_source: "llm", verified: false });
  }

  return NextResponse.json(created);
}
