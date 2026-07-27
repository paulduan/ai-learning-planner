import { NextResponse } from "next/server";
import {
  getConceptsByPlan,
  getRelationsByPlan,
  createConcept,
  updateConcept,
  deleteConcept,
  createRelation,
  deleteRelation,
} from "@/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json({ error: "缺少 plan_id 参数" }, { status: 400 });
    }

    const concepts = getConceptsByPlan(planId);
    const relations = getRelationsByPlan(planId);

    return NextResponse.json({ concepts, relations });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "add_concept": {
        const { plan_id, name, definition, mastery_status, source_stage_ids } = body;
        if (!plan_id || !name) {
          return NextResponse.json({ error: "缺少 plan_id 或 name" }, { status: 400 });
        }
        const id = createConcept({
          plan_id,
          name,
          definition,
          mastery_status,
          source_stage_ids,
        });
        return NextResponse.json({ success: true, id });
      }

      case "update_concept": {
        const { id, ...updates } = body;
        if (!id) {
          return NextResponse.json({ error: "缺少 id" }, { status: 400 });
        }
        updateConcept(id, updates);
        return NextResponse.json({ success: true });
      }

      case "delete_concept": {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: "缺少 id" }, { status: 400 });
        }
        deleteConcept(id);
        return NextResponse.json({ success: true });
      }

      case "add_relation": {
        const { plan_id, from_concept_id, to_concept_id, relation_type, source } = body;
        if (!plan_id || !from_concept_id || !to_concept_id || !relation_type) {
          return NextResponse.json(
            { error: "缺少必要参数: plan_id, from_concept_id, to_concept_id, relation_type" },
            { status: 400 }
          );
        }
        const id = createRelation({
          plan_id,
          from_concept_id,
          to_concept_id,
          relation_type,
          source,
        });
        return NextResponse.json({ success: true, id });
      }

      case "delete_relation": {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: "缺少 id" }, { status: 400 });
        }
        deleteRelation(id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "无效的 action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
