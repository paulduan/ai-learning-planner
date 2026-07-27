import { NextResponse } from "next/server";
import {
  getPlanStats,
  getDailyStudyTime,
  getHourlyDistribution,
} from "@/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");
    const type = searchParams.get("type") || "overview";

    if (!planId) {
      return NextResponse.json({ error: "缺少 plan_id 参数" }, { status: 400 });
    }

    switch (type) {
      case "overview":
        return NextResponse.json(getPlanStats(planId));
      case "daily":
        return NextResponse.json(getDailyStudyTime(planId, 30));
      case "hourly":
        return NextResponse.json(getHourlyDistribution(planId));
      default:
        return NextResponse.json(
          { error: "无效的 type 参数，可选: overview, daily, hourly" },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
