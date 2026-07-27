import { NextResponse } from "next/server";
import { getStage, getStageNote, upsertStageNote, getChatHistory } from "@/db/queries";
import { generateStageSummary } from "@/lib/ai";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stage = getStage(id);
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const note = getStageNote(id);
  return NextResponse.json({
    ai_summary: note?.ai_summary || "",
    user_notes: note?.user_notes || "",
    updated_at: note?.updated_at || null,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stage = getStage(id);
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const body = await request.json();
  upsertStageNote(id, { user_notes: body.user_notes || "" });
  const note = getStageNote(id);
  return NextResponse.json({
    ai_summary: note?.ai_summary || "",
    user_notes: note?.user_notes || "",
    updated_at: note?.updated_at || null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stage = getStage(id);
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const existing = getStageNote(id);
  const chatHistory = getChatHistory(id);

  try {
    const summary = await generateStageSummary({
      stage_title: stage.title,
      key_topics: stage.key_topics,
      learning_objectives: stage.learning_objectives || [],
      chat_history: chatHistory,
      user_notes: body.user_notes ?? existing?.user_notes,
    });

    upsertStageNote(id, { ai_summary: summary });
    const note = getStageNote(id);
    return NextResponse.json({
      ai_summary: note?.ai_summary || "",
      user_notes: note?.user_notes || "",
      updated_at: note?.updated_at || null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
