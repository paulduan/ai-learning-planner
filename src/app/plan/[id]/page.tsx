"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Plan {
  id: string;
  title: string;
  goal_description: string;
  status: string;
  total_stages: number;
  current_stage_index: number;
  duration_weeks: number;
  daily_hours: number;
}

interface PlanSummary {
  id: string;
  title: string;
  status: string;
  total_stages: number;
}

interface Stage {
  id: string;
  plan_id: string;
  order_index: number;
  title: string;
  description: string;
  key_topics: string[];
  estimated_days: number;
  status: string;
  resource_completion_rate: number;
  core_output?: string;
  real_world_cases?: string[];
  summary_text?: string;
}

interface Resource {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  reason: string;
  estimated_minutes: number;
  region_tag: string;
  is_completed: boolean;
  search_source?: string;
  verified?: boolean;
}

interface ChatMsg {
  role: string;
  content: string;
}

interface StageProject {
  id: string;
  stage_id: string;
  title: string;
  description: string;
  expected_output: string;
  checklist: { item: string; completed: boolean }[];
  output_notes: string;
  difficulty: string;
  estimated_minutes: number;
  status: string;
}

type RightPanel = "learn" | "resources" | "project" | "info" | "notes";

export default function PlanDashboard() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [allPlans, setAllPlans] = useState<PlanSummary[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [generatingResources, setGeneratingResources] = useState(false);

  const [rightPanel, setRightPanel] = useState<RightPanel>("learn");
  const [project, setProject] = useState<StageProject | null>(null);
  const [dueReviewCount, setDueReviewCount] = useState(0);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoadedFor, setChatLoadedFor] = useState<string | null>(null);
  const [stageNote, setStageNote] = useState({ ai_summary: "", user_notes: "" });
  const [savingNotes, setSavingNotes] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [planRes, allPlansRes] = await Promise.all([
        fetch(`/api/plan?id=${planId}`),
        fetch("/api/plan?all=true"),
      ]);
      const data = await planRes.json();
      const allPlansData = await allPlansRes.json();
      setAllPlans(Array.isArray(allPlansData) ? allPlansData : []);

      if (data?.plan) {
        setPlan(data.plan);
        setStages(data.stages);
        const active = data.stages.find((s: Stage) => s.status === "active");
        if (active) setSelectedStageId(active.id);
        else if (data.stages.length > 0) setSelectedStageId(data.stages[0].id);
      }
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function handleFocus() {
      loadData();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadData]);

  useEffect(() => {
    if (!selectedStageId) return;
    setLoadingResources(true);
    fetch(`/api/stage/${selectedStageId}/resources`)
      .then((r) => r.json())
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoadingResources(false));

    fetch(`/api/project?stage_id=${selectedStageId}`)
      .then((r) => r.json())
      .then((d) => setProject(d || null))
      .catch(() => setProject(null));

    fetch(`/api/stage/${selectedStageId}/notes`)
      .then((r) => r.json())
      .then((d) => setStageNote({
        ai_summary: d.ai_summary || "",
        user_notes: d.user_notes || "",
      }))
      .catch(() => setStageNote({ ai_summary: "", user_notes: "" }));
  }, [selectedStageId]);

  useEffect(() => {
    fetch(`/api/review?plan_id=${planId}`)
      .then((r) => r.json())
      .then((d) => setDueReviewCount(d?.pending?.length || 0))
      .catch(() => {});
  }, [planId]);

  useEffect(() => {
    if (selectedStageId && rightPanel === "learn" && chatLoadedFor !== selectedStageId) {
      loadChat(selectedStageId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStageId, rightPanel]);

  async function loadChat(stageId: string) {
    try {
      const res = await fetch(`/api/stage/${stageId}/chat`);
      const data = await res.json();
      setChatMessages(data);
      setChatLoadedFor(stageId);
      if (data.length === 0) {
        await sendChatMessage("开始学习", stageId);
      }
    } catch { /* ignore */ }
  }

  async function sendChatMessage(text: string, stageId?: string) {
    const sid = stageId || selectedStageId;
    if (!sid) return;
    setChatSending(true);
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatInput("");
    try {
      const res = await fetch(`/api/stage/${sid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error("发送失败");
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChatSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleGenerateResources() {
    if (!selectedStageId) return;
    setGeneratingResources(true);
    try {
      const res = await fetch(`/api/stage/${selectedStageId}/resources`, { method: "POST" });
      if (!res.ok) throw new Error("生成失败");
      const data = await res.json();
      setResources((prev) => [...prev, ...data]);
      toast.success("资料已生成");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGeneratingResources(false);
    }
  }

  async function handleToggleChecklist(index: number) {
    if (!project) return;
    const newChecklist = [...project.checklist];
    newChecklist[index] = { ...newChecklist[index], completed: !newChecklist[index].completed };
    const allDone = newChecklist.every(c => c.completed);
    const newStatus = allDone ? "completed" : "in_progress";

    try {
      await fetch(`/api/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          checklist: newChecklist,
          status: newStatus,
          ...(allDone ? { completed_at: new Date().toISOString() } : {}),
        }),
      });
      setProject({ ...project, checklist: newChecklist, status: newStatus });
      if (allDone) toast.success("项目已完成！");
    } catch {
      toast.error("更新失败");
    }
  }

  async function handleToggleResource(resourceId: string, completed: boolean) {
    try {
      await fetch(`/api/resource/${resourceId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      setResources((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, is_completed: completed } : r))
      );
    } catch {
      toast.error("更新失败");
    }
  }

  async function handleSaveUserNotes() {
    if (!selectedStageId) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/stage/${selectedStageId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_notes: stageNote.user_notes }),
      });
      if (!res.ok) throw new Error("保存失败");
      const data = await res.json();
      setStageNote({
        ai_summary: data.ai_summary || "",
        user_notes: data.user_notes || "",
      });
      toast.success("笔记已保存");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleGenerateAiSummary() {
    if (!selectedStageId) return;
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/stage/${selectedStageId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_notes: stageNote.user_notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "生成失败");
      }
      const data = await res.json();
      setStageNote({
        ai_summary: data.ai_summary || "",
        user_notes: data.user_notes || "",
      });
      toast.success("AI 笔记已生成");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGeneratingSummary(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">计划不存在</p>
          <Button onClick={() => router.push("/")}>返回</Button>
        </div>
      </div>
    );
  }

  const selectedStage = stages.find((s) => s.id === selectedStageId);
  const completedStages = stages.filter((s) => s.status === "completed").length;
  const progress = plan.total_stages > 0 ? (completedStages / plan.total_stages) * 100 : 0;
  const completedResources = resources.filter((r) => r.is_completed).length;

  const visibleMessages = chatMessages.filter(
    (m) => !(m.role === "user" && m.content === "开始学习")
  );

  const typeIcons: Record<string, string> = {
    article: "📄", video: "🎬", doc: "📚", book: "📖", repo: "💻", paper: "📝",
  };

  return (
    <div className="h-screen flex bg-background">
      {/* ===== 左侧导航栏 ===== */}
      <aside className="w-56 shrink-0 bg-[#1a1a2e] flex flex-col">
        <div className="pt-10 px-5 pb-4">
          <h1 className="text-base font-bold text-white">🎯 精细化 AI 规划</h1>
          <p className="text-[11px] text-white/40 mt-1">个性化学习教练</p>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          <p className="text-[10px] text-white/30 uppercase tracking-wider px-2 mb-2">学习阶段</p>

          {stages.map((stage, i) => {
            const isSelected = stage.id === selectedStageId;
            const isCompleted = stage.status === "completed";
            const isLocked = stage.status === "locked";
            const isActive = stage.status === "active";

            return (
              <button
                key={stage.id}
                onClick={() => {
                  if (!isLocked) {
                    setSelectedStageId(stage.id);
                    setRightPanel("learn");
                  }
                }}
                disabled={isLocked}
                title={isLocked ? "完成上一阶段检测后解锁" : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 flex items-center gap-2.5 text-sm transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-medium"
                    : isLocked
                      ? "text-white/20 cursor-not-allowed"
                      : "text-white/60 hover:text-white/90 hover:bg-white/5"
                }`}
              >
                <span className="text-xs w-5 text-center shrink-0">
                  {isCompleted ? "🚩" : isLocked ? "🔒" : isActive ? "📖" : `${i + 1}`}
                </span>
                <span className="truncate text-xs">{stage.title}</span>
              </button>
            );
          })}

          {allPlans.length > 1 && (
            <>
              <div className="h-px bg-white/10 my-3" />
              <p className="text-[10px] text-white/30 uppercase tracking-wider px-2 mb-2">其他计划</p>
              {allPlans.filter((p) => p.id !== plan.id).map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 rounded-lg mb-0.5 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all truncate"
                  onClick={() => router.push(`/plan/${p.id}`)}
                >
                  {p.status === "completed" ? "✅ " : "📖 "}{p.title}
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px] text-white/30 mb-2 px-1">
            <span>进度 {completedStages}/{plan.total_stages}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1 mb-3" />

          <p className="text-[10px] text-white/30 uppercase tracking-wider px-2 mb-1 mt-2">功能</p>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex items-center justify-between"
            onClick={() => router.push(`/review?plan_id=${planId}`)}
          >
            <span>🔄 复习中心</span>
            {dueReviewCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">{dueReviewCount}</span>
            )}
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
            onClick={() => router.push(`/plan/${planId}/graph`)}
          >
            🧠 知识图谱
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
            onClick={() => router.push(`/plan/${planId}/analytics`)}
          >
            📊 学习洞察
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
            onClick={() => router.push(`/plan/${planId}/export`)}
          >
            📤 导出中心
          </button>

          <div className="h-px bg-white/5 my-2" />
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
            onClick={() => router.push("/plan/new")}
          >
            + 新建计划
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
            onClick={() => router.push("/settings")}
          >
            ⚙️ 设置
          </button>
        </div>
      </aside>

      {/* ===== 右侧内容区 ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedStage ? (
          <>
            {/* 阶段头部 + 面板切换 */}
            <div className="shrink-0 border-b border-border/20 px-8 py-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary">
                      第 {selectedStage.order_index + 1} 阶段
                    </Badge>
                    <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 ${
                      selectedStage.status === "completed" ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-400"
                    }`}>
                      {selectedStage.status === "completed" ? "已完成" : "进行中"}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold">{selectedStage.title}</h2>
                </div>

                {selectedStage.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-xs shrink-0"
                    onClick={() => router.push(`/plan/${planId}/stage/${selectedStageId}/assess`)}
                  >
                    ✍️ 申请检测
                  </Button>
                )}
              </div>

              {/* 面板切换按钮 */}
              <div className="flex gap-1">
                {([
                  { key: "learn" as RightPanel, label: "💬 AI 教学" },
                  { key: "resources" as RightPanel, label: `📚 资料 (${resources.length})` },
                  { key: "project" as RightPanel, label: `🛠️ 实战项目` },
                  { key: "notes" as RightPanel, label: "📝 阶段笔记" },
                  { key: "info" as RightPanel, label: "📖 详情" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setRightPanel(tab.key)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                      rightPanel === tab.key
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-hidden">
              {/* AI 教学面板 */}
              {rightPanel === "learn" && (
                <div className="h-full flex flex-col">
                  {selectedStage.status === "active" && visibleMessages.length >= 2 && (
                    <div className="shrink-0 mx-8 mt-4 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-3">
                      <p className="text-xs text-amber-200/80">
                        学完本阶段后，通过「申请检测」解锁下一阶段
                      </p>
                      <Button
                        size="sm"
                        className="rounded-lg text-xs shrink-0 h-8"
                        onClick={() => router.push(`/plan/${planId}/stage/${selectedStageId}/assess`)}
                      >
                        ✍️ 申请检测
                      </Button>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
                    {visibleMessages.length === 0 && !chatSending && (
                      <div className="flex flex-col items-center py-12 text-center">
                        <span className="text-3xl mb-3">💬</span>
                        <p className="text-sm font-medium mb-1">AI 对话教学</p>
                        <p className="text-xs text-muted-foreground max-w-xs">
                          AI 导师会通过提问引导你思考，像真正的一对一家教一样。
                        </p>
                      </div>
                    )}

                    {visibleMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2.5 mt-1 shrink-0">
                            <span className="text-xs">🤖</span>
                          </div>
                        )}
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border/30 rounded-bl-sm"
                          }`}
                        >
                          {msg.content.split("\n").map((line, j) => (
                            <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}

                    {chatSending && (
                      <div className="flex justify-start">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2.5 shrink-0">
                          <span className="text-xs">🤖</span>
                        </div>
                        <div className="bg-card border border-border/30 rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1.5">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="shrink-0 border-t border-border/20 px-8 py-4">
                    <div className="flex gap-2 max-w-2xl items-end">
                      <Textarea
                        ref={inputRef}
                        placeholder="输入你的回答或问题...（Shift+Enter 换行）"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && chatInput.trim() && !chatSending) {
                            e.preventDefault();
                            sendChatMessage(chatInput.trim());
                          }
                        }}
                        disabled={chatSending}
                        rows={1}
                        className="flex-1 rounded-lg min-h-10 max-h-40 resize-y"
                      />
                      <Button
                        onClick={() => chatInput.trim() && sendChatMessage(chatInput.trim())}
                        disabled={!chatInput.trim() || chatSending}
                        className="rounded-lg px-5 h-10 shrink-0"
                      >
                        发送
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 资料面板 */}
              {rightPanel === "resources" && (
                <div className="h-full overflow-y-auto px-8 py-6">
                  <div className="max-w-2xl">
                    {loadingResources ? (
                      <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
                    ) : resources.length === 0 ? (
                      <div className="py-12 text-center">
                        <span className="text-3xl block mb-3">📚</span>
                        <p className="text-sm text-muted-foreground mb-4">暂无学习资料</p>
                        <Button onClick={handleGenerateResources} disabled={generatingResources} className="rounded-lg">
                          {generatingResources ? "AI 推荐中..." : "让 AI 推荐资料"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">学习资料</h3>
                          <span className="text-xs text-muted-foreground">{completedResources}/{resources.length} 已完成</span>
                        </div>
                        {resources.map((resource) => {
                          const isVerified = resource.search_source === "tavily" || resource.verified;
                          return (
                            <div
                              key={resource.id}
                              className={`flex items-start gap-3 px-4 py-3 rounded-xl border border-border/20 bg-card/20 hover:bg-card/40 transition-colors ${
                                resource.is_completed ? "opacity-40" : ""
                              }`}
                            >
                              <button
                                onClick={() => handleToggleResource(resource.id, !resource.is_completed)}
                                className={`mt-0.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 ${
                                  resource.is_completed ? "bg-primary border-primary" : "border-border/50 hover:border-primary/50"
                                }`}
                              >
                                {resource.is_completed && <span className="text-[10px] text-primary-foreground">✓</span>}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">{typeIcons[resource.type] || "📄"}</span>
                                  <a href={resource.url} target="_blank" rel="noopener noreferrer"
                                    className={`text-sm hover:text-primary ${resource.is_completed ? "line-through" : "font-medium"}`}
                                  >{resource.title}</a>
                                  {isVerified && <span className="text-[10px] text-green-400">🔍</span>}
                                </div>
                                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                                  {resource.source}{resource.estimated_minutes > 0 && ` · ${resource.estimated_minutes}min`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          onClick={handleGenerateResources}
                          disabled={generatingResources}
                          className="w-full py-2.5 rounded-xl border border-dashed border-border/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {generatingResources ? "加载中..." : "+ 获取更多资料"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 实战项目面板 */}
              {rightPanel === "project" && (
                <div className="h-full overflow-y-auto px-8 py-6">
                  <div className="max-w-2xl">
                    {project ? (
                      <div className="space-y-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{project.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 ${
                                project.status === "completed" ? "bg-green-500/10 text-green-500"
                                : project.status === "in_progress" ? "bg-blue-500/10 text-blue-400"
                                : "bg-gray-500/10 text-gray-400"
                              }`}>
                                {project.status === "completed" ? "已完成" : project.status === "in_progress" ? "进行中" : "未开始"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {project.difficulty === "easy" ? "简单" : project.difficulty === "hard" ? "困难" : "中等"}
                                {" · "}约 {project.estimated_minutes} 分钟
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="px-5 py-4 rounded-xl border border-border/20 bg-card/20">
                          <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-3">🎯 预期产出</h4>
                          <div className="px-5 py-4 rounded-xl bg-green-500/5 border border-green-500/10">
                            <p className="text-sm text-green-400/90">{project.expected_output}</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium">📋 完成步骤</h4>
                            <span className="text-xs text-muted-foreground">
                              {project.checklist.filter(c => c.completed).length}/{project.checklist.length}
                            </span>
                          </div>
                          <Progress
                            value={project.checklist.length > 0
                              ? (project.checklist.filter(c => c.completed).length / project.checklist.length) * 100
                              : 0}
                            className="h-1.5 mb-4"
                          />
                          <div className="space-y-2">
                            {project.checklist.map((item, i) => (
                              <div
                                key={i}
                                className={`flex items-start gap-3 px-4 py-3 rounded-xl border border-border/20 bg-card/20 hover:bg-card/40 transition-colors cursor-pointer ${
                                  item.completed ? "opacity-50" : ""
                                }`}
                                onClick={() => handleToggleChecklist(i)}
                              >
                                <div className={`mt-0.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 ${
                                  item.completed ? "bg-primary border-primary" : "border-border/50 hover:border-primary/50"
                                }`}>
                                  {item.completed && <span className="text-[10px] text-primary-foreground">✓</span>}
                                </div>
                                <span className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                  {item.item}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <span className="text-3xl block mb-3">🛠️</span>
                        <p className="text-sm text-muted-foreground mb-1">此阶段暂无实战项目</p>
                        <p className="text-xs text-muted-foreground/50">完成前一阶段评估后将自动生成</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 阶段笔记面板 */}
              {rightPanel === "notes" && (
                <div className="h-full overflow-y-auto px-8 py-6">
                  <div className="max-w-2xl space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={handleGenerateAiSummary}
                        disabled={generatingSummary}
                        className="rounded-lg"
                      >
                        {generatingSummary ? "AI 总结中..." : "🤖 AI 总结本阶段"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleSaveUserNotes}
                        disabled={savingNotes}
                        className="rounded-lg"
                      >
                        {savingNotes ? "保存中..." : "💾 保存我的笔记"}
                      </Button>
                    </div>

                    {(() => {
                      const parsed = tryParseStructuredSummary(stageNote.ai_summary);
                      if (parsed) {
                        return (
                          <div className="space-y-5">
                            {/* One-line summary */}
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                              <p className="text-sm font-medium text-primary">
                                📌 {parsed.one_line_summary}
                              </p>
                            </div>

                            {/* Core Concepts */}
                            <div>
                              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span>🧠</span> 核心概念掌握
                              </h3>
                              <div className="grid grid-cols-1 gap-2">
                                {parsed.core_concepts.map((c, i) => (
                                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card/30 border border-border/20">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                      c.mastery === "solid" ? "bg-green-400" :
                                      c.mastery === "partial" ? "bg-amber-400" : "bg-red-400"
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{c.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                          c.mastery === "solid" ? "bg-green-500/10 text-green-400" :
                                          c.mastery === "partial" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                                        }`}>
                                          {c.mastery === "solid" ? "掌握" : c.mastery === "partial" ? "部分" : "待加强"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">{c.explanation}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Key Takeaways */}
                            <div>
                              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span>💡</span> 关键收获
                              </h3>
                              <div className="space-y-1.5">
                                {parsed.key_takeaways.map((t, i) => (
                                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                                    <span className="text-green-400 text-xs mt-0.5">✓</span>
                                    <p className="text-sm text-muted-foreground">{t}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Open Questions */}
                            {parsed.open_questions.length > 0 && (
                              <div>
                                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <span>❓</span> 待深入问题
                                </h3>
                                <div className="space-y-1.5">
                                  {parsed.open_questions.map((q, i) => (
                                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                      <span className="text-amber-400 text-xs mt-0.5">?</span>
                                      <p className="text-sm text-muted-foreground">{q}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Next Actions */}
                            <div>
                              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span>🎯</span> 下一步行动
                              </h3>
                              <div className="space-y-1.5">
                                {parsed.next_actions.map((a, i) => (
                                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                    <span className="text-blue-400 text-xs mt-0.5">→</span>
                                    <p className="text-sm text-muted-foreground">{a}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (stageNote.ai_summary) {
                        return (
                          <div>
                            <h3 className="text-sm font-medium mb-2">AI 阶段笔记</h3>
                            <div className="px-5 py-4 rounded-xl border border-border/20 bg-card/20 min-h-[120px]">
                              {stageNote.ai_summary.split("\n").map((line, i) => (
                                <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0">{line}</p>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="px-5 py-8 rounded-xl border border-dashed border-border/30 bg-card/10 text-center">
                          <span className="text-3xl mb-3 block">📝</span>
                          <p className="text-sm text-muted-foreground/60">
                            点击「AI 总结本阶段」，根据对话内容生成可视化学习总结
                          </p>
                        </div>
                      );
                    })()}

                    <div>
                      <h3 className="text-sm font-medium mb-2">我的整理</h3>
                      <Textarea
                        placeholder="在这里记录你的理解、疑问和心得..."
                        value={stageNote.user_notes}
                        onChange={(e) => setStageNote((prev) => ({ ...prev, user_notes: e.target.value }))}
                        className="min-h-[220px] max-h-[50vh] resize-y rounded-xl"
                      />
                      <p className="text-[11px] text-muted-foreground/60 mt-2">
                        支持多行输入，内容较长时可拖动右下角调整高度
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 详情面板 */}
              {rightPanel === "info" && (
                <div className="h-full overflow-y-auto px-8 py-6">
                  <div className="max-w-2xl space-y-8">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">阶段说明</h3>
                      <p className="text-muted-foreground leading-relaxed">{selectedStage.description}</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">知识点</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStage.key_topics.map((topic) => (
                          <span key={topic} className="px-3 py-1.5 rounded-lg border border-border/40 bg-card/30 text-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedStage.core_output && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">🎯 目标产出</h3>
                        <div className="px-5 py-4 rounded-xl bg-green-500/5 border border-green-500/10">
                          <p className="text-sm text-green-400/90">{selectedStage.core_output}</p>
                        </div>
                      </div>
                    )}

                    {selectedStage.summary_text && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">📖 导读</h3>
                        <div className="px-5 py-4 rounded-xl border border-border/20 bg-card/20">
                          {selectedStage.summary_text.split("\n").map((line, i) => (
                            <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0">{line}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedStage.real_world_cases && selectedStage.real_world_cases.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">🌍 真实案例</h3>
                        <div className="space-y-2.5">
                          {selectedStage.real_world_cases.map((c, i) => (
                            <div key={i} className="px-5 py-4 rounded-xl border border-border/20 bg-card/20">
                              <p className="text-sm text-muted-foreground leading-relaxed">{c}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">← 选择一个阶段开始学习</p>
          </div>
        )}
      </main>
    </div>
  );
}

interface StructuredSummaryData {
  core_concepts: { name: string; explanation: string; mastery: "solid" | "partial" | "weak" }[];
  key_takeaways: string[];
  open_questions: string[];
  next_actions: string[];
  one_line_summary: string;
}

function tryParseStructuredSummary(text: string): StructuredSummaryData | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed.core_concepts && parsed.key_takeaways && parsed.one_line_summary) {
      return parsed as StructuredSummaryData;
    }
  } catch {
    // Not JSON - old markdown format
  }
  return null;
}
