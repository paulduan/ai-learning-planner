import { NextRequest, NextResponse } from "next/server";
import { searchTavily } from "@/lib/datasource";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, maxResults, searchDepth } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: "缺少搜索关键词" }, { status: 400 });
    }

    const results = await searchTavily(query.trim(), {
      maxResults: maxResults || 8,
      searchDepth: searchDepth || "basic",
    });

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
