import { NextResponse } from "next/server";
import {
  getPendingReviews,
  getReviewSchedulesByPlan,
  expireOverdueReviews,
  getAllDueReviewCount,
  createReviewSession,
  type ReviewSchedule,
} from "@/db/queries";
import { getDb } from "@/db/schema";

function categorizeReviews(schedules: ReviewSchedule[]) {
  const now = new Date().toISOString();
  const pending = schedules.filter(
    (s) =>
      (s.status === "pending" || s.status === "expired") &&
      s.scheduled_at <= now
  );
  const upcoming = schedules.filter(
    (s) => s.status === "pending" && s.scheduled_at > now
  );
  const completed = schedules.filter((s) => s.status === "completed");
  return { pending, upcoming, completed };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");

    expireOverdueReviews();
    getAllDueReviewCount();

    let schedules: ReviewSchedule[];
    if (planId) {
      schedules = getReviewSchedulesByPlan(planId);
    } else {
      const db = getDb();
      schedules = db
        .prepare("SELECT * FROM review_schedule ORDER BY scheduled_at ASC")
        .all() as ReviewSchedule[];
    }

    const { upcoming, completed } = categorizeReviews(schedules);
    const pending = planId ? getPendingReviews(planId) : getPendingReviews();

    return NextResponse.json({ pending, upcoming, completed });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { review_schedule_id, questions, score, duration_minutes } = body;

    if (!review_schedule_id || !Array.isArray(questions) || score == null) {
      return NextResponse.json(
        { error: "缺少必要参数: review_schedule_id, questions, score" },
        { status: 400 }
      );
    }

    const id = createReviewSession({
      review_schedule_id,
      questions,
      score: Number(score),
      duration_minutes: Number(duration_minutes) || 0,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
