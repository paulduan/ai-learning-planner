import { NextResponse } from "next/server";
import { getAssessmentsByStage } from "@/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const assessments = getAssessmentsByStage(id);
  return NextResponse.json(assessments);
}
