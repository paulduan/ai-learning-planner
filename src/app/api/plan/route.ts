import { NextResponse } from "next/server";
import { getActivePlan, getAllPlans, getPlan, getStagesByPlan, syncStageUnlockState } from "@/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all");
  const id = searchParams.get("id");

  if (all === "true") {
    const plans = getAllPlans();
    return NextResponse.json(plans);
  }

  if (id) {
    const plan = getPlan(id);
    if (!plan) return NextResponse.json(null);
    syncStageUnlockState(plan.id);
    const stages = getStagesByPlan(plan.id);
    return NextResponse.json({ plan, stages });
  }

  const plan = getActivePlan();
  if (!plan) {
    return NextResponse.json(null);
  }

  syncStageUnlockState(plan.id);
  const stages = getStagesByPlan(plan.id);
  return NextResponse.json({ plan, stages });
}
