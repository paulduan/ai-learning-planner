import { NextResponse } from "next/server";
import { startLearningSession, endLearningSession } from "@/db/queries";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, plan_id, stage_id, activity_type, session_id } = body;

    if (action === "start") {
      if (!plan_id) {
        return NextResponse.json({ error: "缺少 plan_id" }, { status: 400 });
      }
      const id = startLearningSession(
        plan_id,
        stage_id || null,
        activity_type || "learning"
      );
      return NextResponse.json({ success: true, session_id: id });
    }

    if (action === "end") {
      if (!session_id) {
        return NextResponse.json({ error: "缺少 session_id" }, { status: 400 });
      }
      endLearningSession(session_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "无效的 action，可选: start, end" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
