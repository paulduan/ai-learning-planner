"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface KnowledgeConcept {
  id: string;
  plan_id: string;
  name: string;
  definition: string;
  mastery_status: string;
  source_stage_ids: string[];
  created_at: string;
  updated_at: string;
}

interface KnowledgeRelation {
  id: string;
  plan_id: string;
  from_concept_id: string;
  to_concept_id: string;
  relation_type: string;
  source: string;
  created_at: string;
}

interface Stage {
  id: string;
  order_index: number;
  title: string;
}

interface ConceptNodeData {
  concept: KnowledgeConcept;
}

const MASTERY_CONFIG: Record<
  string,
  { label: string; border: string; dot: string; minimap: string }
> = {
  untouched: {
    label: "未学",
    border: "border-zinc-500/60",
    dot: "bg-zinc-400",
    minimap: "#71717a",
  },
  learning: {
    label: "学习中",
    border: "border-yellow-500/70",
    dot: "bg-yellow-400",
    minimap: "#facc15",
  },
  mastered: {
    label: "已掌握",
    border: "border-green-500/70",
    dot: "bg-green-400",
    minimap: "#4ade80",
  },
  needs_review: {
    label: "需复习",
    border: "border-orange-500/70",
    dot: "bg-orange-400",
    minimap: "#fb923c",
  },
};

const RELATION_CONFIG: Record<
  string,
  { label: string; color: string; dasharray?: string; animated?: boolean }
> = {
  prerequisite: { label: "前置", color: "#60a5fa", animated: true },
  contains: { label: "包含", color: "#94a3b8", dasharray: "6 4" },
  related: { label: "相关", color: "#c084fc", dasharray: "2 4" },
  applied_in: { label: "应用", color: "#4ade80" },
};

function ConceptNode({ data, selected }: NodeProps<ConceptNodeData>) {
  const config =
    MASTERY_CONFIG[data.concept.mastery_status] ?? MASTERY_CONFIG.untouched;

  return (
    <div
      className={`px-3 py-2.5 rounded-xl min-w-[120px] max-w-[180px] bg-card/80 backdrop-blur-sm border-2 shadow-lg transition-all ${config.border} ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground !border-none"
      />
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
        <span className="text-xs font-medium text-foreground truncate">
          {data.concept.name}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground !border-none"
      />
    </div>
  );
}

const nodeTypes = { conceptNode: ConceptNode };

function layoutConceptNodes(
  concepts: KnowledgeConcept[],
  stages: Stage[]
): Node<ConceptNodeData>[] {
  const stageOrder = new Map(stages.map((s) => [s.id, s.order_index]));
  const groups = new Map<number, KnowledgeConcept[]>();

  for (const concept of concepts) {
    let minOrder = Infinity;
    for (const stageId of concept.source_stage_ids ?? []) {
      const order = stageOrder.get(stageId);
      if (order !== undefined) minOrder = Math.min(minOrder, order);
    }
    if (minOrder === Infinity) minOrder = 0;
    if (!groups.has(minOrder)) groups.set(minOrder, []);
    groups.get(minOrder)!.push(concept);
  }

  const nodes: Node<ConceptNodeData>[] = [];
  const sortedGroups = [...groups.entries()].sort((a, b) => a[0] - b[0]);

  sortedGroups.forEach(([_, groupConcepts], colIndex) => {
    groupConcepts.forEach((concept, rowIndex) => {
      nodes.push({
        id: concept.id,
        type: "conceptNode",
        position: { x: colIndex * 260 + 40, y: rowIndex * 110 + 40 },
        data: { concept },
      });
    });
  });

  return nodes;
}

function relationsToEdges(relations: KnowledgeRelation[]): Edge[] {
  return relations.map((relation) => {
    const config =
      RELATION_CONFIG[relation.relation_type] ?? RELATION_CONFIG.related;

    return {
      id: relation.id,
      source: relation.from_concept_id,
      target: relation.to_concept_id,
      label: config.label,
      animated: config.animated ?? false,
      style: {
        stroke: config.color,
        strokeWidth: 2,
        ...(config.dasharray ? { strokeDasharray: config.dasharray } : {}),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: config.color,
        width: 16,
        height: 16,
      },
      labelStyle: { fill: "#94a3b8", fontSize: 10, fontWeight: 500 },
      labelBgStyle: {
        fill: "oklch(0.155 0.015 270)",
        fillOpacity: 0.85,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    };
  });
}

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [planTitle, setPlanTitle] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [concepts, setConcepts] = useState<KnowledgeConcept[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<KnowledgeConcept | null>(
    null
  );
  const [updating, setUpdating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [planRes, graphRes] = await Promise.all([
        fetch(`/api/plan?id=${planId}`),
        fetch(`/api/graph?plan_id=${planId}`),
      ]);

      const planData = await planRes.json();
      const graphData = await graphRes.json();

      if (planData?.plan) {
        setPlanTitle(planData.plan.title);
        setStages(planData.stages ?? []);
      }

      setConcepts(graphData.concepts ?? []);
      setRelations(graphData.relations ?? []);
    } catch {
      toast.error("加载知识图谱失败");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const nodes = useMemo(
    () => layoutConceptNodes(concepts, stages),
    [concepts, stages]
  );

  const edges = useMemo(() => relationsToEdges(relations), [relations]);

  const stageMap = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ConceptNodeData>) => {
      setSelectedConcept(node.data.concept);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedConcept(null);
  }, []);

  async function handleMarkMastered() {
    if (!selectedConcept) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_concept",
          id: selectedConcept.id,
          mastery_status: "mastered",
        }),
      });
      if (!res.ok) throw new Error("更新失败");

      const updated = { ...selectedConcept, mastery_status: "mastered" };
      setConcepts((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setSelectedConcept(updated);
      toast.success("已标记为掌握");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  const selectedMastery =
    selectedConcept &&
    (MASTERY_CONFIG[selectedConcept.mastery_status] ?? MASTERY_CONFIG.untouched);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">加载知识图谱...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="app-region-drag shrink-0 border-b border-border/40 bg-card/40 backdrop-blur-md pl-20 pr-6 py-3.5 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/plan/${planId}`)}
          className="app-region-no-drag text-muted-foreground hover:text-foreground"
        >
          ← 返回计划
        </Button>
        <h1 className="text-base font-semibold truncate">
          🧠 知识图谱: {planTitle || "学习计划"}
        </h1>
      </header>

      {/* Graph area */}
      <div className="flex-1 relative min-h-0">
        {concepts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span className="text-4xl">🧠</span>
            <p className="text-muted-foreground text-sm">暂无知识概念</p>
            <p className="text-muted-foreground/60 text-xs max-w-xs text-center">
              生成学习计划后，AI 会自动提取知识点并构建关系图谱
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg app-region-no-drag"
              onClick={() => router.push(`/plan/${planId}`)}
            >
              返回计划
            </Button>
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={1.8}
              proOptions={{ hideAttribution: true }}
              className="dark-flow"
            >
              <Background
                color="oklch(0.4 0.01 270 / 30%)"
                gap={20}
                size={1}
              />
              <Controls
                className="!bg-card/80 !border-border/40 !rounded-lg !shadow-lg [&>button]:!bg-card/60 [&>button]:!border-border/30 [&>button]:!text-foreground [&>button:hover]:!bg-card"
              />
              <MiniMap
                nodeColor={(node) => {
                  const concept = (node.data as ConceptNodeData)?.concept;
                  if (!concept) return "#71717a";
                  return (
                    MASTERY_CONFIG[concept.mastery_status]?.minimap ?? "#71717a"
                  );
                }}
                maskColor="oklch(0.11 0.012 270 / 70%)"
                className="!bg-card/60 !border-border/40 !rounded-lg"
              />
            </ReactFlow>
          </div>
        )}

        {/* Node detail panel */}
        {selectedConcept && selectedMastery && (
          <div className="absolute bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-[360px] glass-card rounded-xl p-5 z-10 app-region-no-drag">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-semibold text-sm leading-snug">
                {selectedConcept.name}
              </h3>
              <button
                onClick={() => setSelectedConcept(null)}
                className="text-muted-foreground hover:text-foreground text-xs shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">定义</p>
                <p className="text-muted-foreground/90 leading-relaxed text-xs">
                  {selectedConcept.definition || "暂无定义"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">状态</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-2 py-0 ${selectedMastery.border} bg-transparent`}
                >
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${selectedMastery.dot}`}
                  />
                  {selectedMastery.label}
                </Badge>
              </div>

              {(selectedConcept.source_stage_ids?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    关联阶段
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedConcept.source_stage_ids.map((stageId) => {
                      const stage = stageMap.get(stageId);
                      return (
                        <span
                          key={stageId}
                          className="text-[10px] px-2 py-0.5 rounded-md border border-border/30 bg-card/40"
                        >
                          {stage
                            ? `第 ${stage.order_index + 1} 阶段 · ${stage.title}`
                            : stageId.slice(0, 8)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 rounded-lg text-xs h-8"
                  onClick={() => router.push(`/plan/${planId}`)}
                >
                  去学习
                </Button>
                {selectedConcept.mastery_status !== "mastered" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-lg text-xs h-8"
                    onClick={handleMarkMastered}
                    disabled={updating}
                  >
                    {updating ? "更新中..." : "标记已掌握"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {concepts.length > 0 && (
          <div className="absolute bottom-4 left-4 glass-card rounded-xl px-4 py-3 z-10 app-region-no-drag">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                未学
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                学习中
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                已掌握
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                需复习
              </span>
              <span className="hidden sm:inline text-border/60">|</span>
              <span className="flex items-center gap-1">
                <span className="text-blue-400">→</span>
                前置
              </span>
              <span className="flex items-center gap-1">
                <span className="text-zinc-400">⇢</span>
                包含
              </span>
              <span className="flex items-center gap-1">
                <span className="text-purple-400">⋯→</span>
                相关
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-400">→</span>
                应用
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .dark-flow .react-flow__pane {
          background: oklch(0.11 0.012 270);
        }
        .dark-flow .react-flow__edge-path {
          stroke-linecap: round;
        }
        .dark-flow .react-flow__controls-button svg {
          fill: currentColor;
        }
      `}</style>
    </div>
  );
}
