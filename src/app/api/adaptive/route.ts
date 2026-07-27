import { NextResponse } from "next/server";
import {
  getAdjustmentsByPlan,
  getLatestMasteryProfile,
  acceptAdjustment,
  updateStage,
  type AdaptiveAdjustment,
  type Stage,
} from "@/db/queries";
import { getDb } from "@/db/schema";

const STAGE_FIELDS = [
  "title",
  "description",
  "key_topics",
  "estimated_days",
  "summary_text",
  "learning_objectives",
  "core_output",
  "real_world_cases",
  "assessment_questions",
] as const;

function applySnapshotToStage(stageId: string, snapshot: Record<string, unknown>) {
  const updates: Partial<Stage> = {};
  for (const field of STAGE_FIELDS) {
    if (field in snapshot) {
      (updates as Record<string, unknown>)[field] = snapshot[field];
    }
  }
  if (Object.keys(updates).length > 0) {
    updateStage(stageId, updates);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json({ error: "缺少 plan_id 参数" }, { status: 400 });
    }

    const adjustments = getAdjustmentsByPlan(planId);
    const mastery = getLatestMasteryProfile(planId);

    return NextResponse.json({ adjustments, mastery });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adjustment_id, accepted } = body;

    if (!adjustment_id || typeof accepted !== "boolean") {
      return NextResponse.json(
        { error: "缺少 adjustment_id 或 accepted 参数" },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM adaptive_adjustment WHERE id = ?")
      .get(adjustment_id) as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    const adjustment: AdaptiveAdjustment = {
      id: row.id as string,
      plan_id: row.plan_id as string,
      stage_id: (row.stage_id as string) || null,
      trigger_reason: row.trigger_reason as string,
      adjustment_type: row.adjustment_type as string,
      before_snapshot: JSON.parse((row.before_snapshot as string) || "{}"),
      after_snapshot: JSON.parse((row.after_snapshot as string) || "{}"),
      user_accepted: row.user_accepted === null ? null : row.user_accepted === 1,
      created_at: row.created_at as string,
    };

    acceptAdjustment(adjustment_id, accepted);

    if (accepted && adjustment.stage_id && adjustment.after_snapshot) {
      applySnapshotToStage(adjustment.stage_id, adjustment.after_snapshot);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
