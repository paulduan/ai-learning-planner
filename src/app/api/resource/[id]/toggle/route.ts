import { NextResponse } from "next/server";
import { toggleResourceComplete } from "@/db/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { completed } = await request.json();
  toggleResourceComplete(id, completed);
  return NextResponse.json({ success: true });
}
