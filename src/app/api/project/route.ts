import { NextResponse } from "next/server";
import {
  getProjectByStage,
  getProjectsByPlan,
  updateStageProject,
} from "@/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get("stage_id");
    const planId = searchParams.get("plan_id");

    if (stageId) {
      const project = getProjectByStage(stageId);
      return NextResponse.json(project);
    }

    if (planId) {
      const projects = getProjectsByPlan(planId);
      return NextResponse.json(projects);
    }

    return NextResponse.json(
      { error: "请提供 stage_id 或 plan_id 参数" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    updateStageProject(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
