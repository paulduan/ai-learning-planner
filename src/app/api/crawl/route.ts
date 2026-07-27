import { NextRequest, NextResponse } from "next/server";
import { crawlUrl } from "@/lib/datasource";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url?.trim()) {
      return NextResponse.json({ error: "缺少 URL" }, { status: 400 });
    }

    const result = await crawlUrl(url.trim());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
