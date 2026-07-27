import { NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/db/queries";

export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    ...config,
    llm_api_key: config.llm_api_key ? "••••" + config.llm_api_key.slice(-4) : "",
    proxy_password: config.proxy_password ? "••••" : "",
    tavily_api_key: config.tavily_api_key ? "••••" + config.tavily_api_key.slice(-4) : "",
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  updateConfig(body);
  return NextResponse.json({ success: true });
}
