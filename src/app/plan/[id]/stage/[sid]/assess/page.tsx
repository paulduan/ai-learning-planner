"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface StageData {
  id: string;
  title: string;
  key_topics: string[];
  order_index: number;
  status: string;
  assessment_questions?: string[];
}

interface AssessmentResult {
  score_overall: number;
  score_coverage: number;
  score_depth: number;
  score_accuracy: number;
  passed: boolean;
  feedback: string;
  missing_topics: string[];
  suggestions: string[];
}

type ViewState = "questions" | "assessing" | "result";

export default function AssessPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const stageId = params.sid as string;

  const [stage, setStage] = useState<StageData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("questions");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/plan?id=${planId}`);
      const data = await res.json();
      if (data?.stages) {
        const found = data.stages.find((s: StageData) => s.id === stageId);
        setStage(found || null);
        if (found && found.status === "active") {
          setRegenerating(true);
          try {
            const regenRes = await fetch(`/api/stage/${stageId}/assess`, { method: "PATCH" });
            if (regenRes.ok) {
              const regenData = await regenRes.json();
              if (regenData.assessment_questions) {
                setStage({ ...found, assessment_questions: regenData.assessment_questions });
              }
            }
          } catch { /* use original questions as fallback */ }
          setRegenerating(false);
        }
      }
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [planId, stageId]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/stage/${stageId}/assess`, { method: "PATCH" });
      if (!res.ok) throw new Error("重新出题失败");
      const data = await res.json();
      if (data.assessment_questions && stage) {
        setStage({ ...stage, assessment_questions: data.assessment_questions });
        setAnswers({});
        setCurrentQIndex(0);
        toast.success("已重新生成检测题");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  const questions = stage?.assessment_questions?.length
    ? stage.assessment_questions
    : stage?.key_topics.map((t) => `请解释你对「${t}」的理解，以及它在实际项目中是如何被使用的？`) || [];

  const currentQ = questions[currentQIndex];
  const answeredCount = Object.values(answers).filter((a) => a?.trim()).length;
  const allAnswered = answeredCount >= questions.length;

  async function handleSubmit() {
    const answerPairs = questions.map((q, i) => ({
      question: q,
      answer: answers[i] || "",
    }));

    const combinedText = answerPairs
      .map((a, i) => `问题${i + 1}: ${a.question}\n回答: ${a.answer}`)
      .join("\n\n");

    setViewState("assessing");

    try {
      const res = await fetch(`/api/stage/${stageId}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_text: combinedText,
          answers: answerPairs,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "评估失败");
      }

      const data = await res.json();
      setResult(data);
      setViewState("result");
    } catch (e) {
      toast.error((e as Error).message);
      setViewState("questions");
    }
  }

  if (loading || regenerating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground animate-pulse">
            {regenerating ? "AI 正在出题..." : "加载中..."}
          </span>
        </div>
      </div>
    );
  }

  if (!stage) {
    router.push(`/plan/${planId}`);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-sm text-muted-foreground animate-pulse">跳转中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-gradient-radial from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <header className="border-b border-border/40 px-6 py-4 bg-card/40 backdrop-blur-md relative z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/plan/${planId}/stage/${stageId}`)}
            className="text-muted-foreground hover:text-foreground"
          >
            ← 返回
          </Button>
          <h1 className="text-lg font-semibold">
            阶段 {stage.order_index + 1} 检测
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {answeredCount}/{questions.length} 已答
            </span>
            <Progress value={(answeredCount / questions.length) * 100} className="w-20 h-1.5" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 relative z-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {viewState === "questions" && (
            <>
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl">💡</span>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      回答以下思考题
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      用自己的话回答，展示你的理解深度。不要复制粘贴。
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground shrink-0"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                  >
                    {regenerating ? "⏳ 出题中..." : "🔄 重新出题"}
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQIndex(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        i === currentQIndex
                          ? "bg-primary text-primary-foreground"
                          : answers[i]?.trim()
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-card/50 text-muted-foreground border border-border/30"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {currentQIndex + 1}
                  </div>
                  <p className="text-base font-medium leading-relaxed pt-1">{currentQ}</p>
                </div>

                <Textarea
                  placeholder="写下你的理解..."
                  value={answers[currentQIndex] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [currentQIndex]: e.target.value })
                  }
                  className="min-h-[200px] resize-y rounded-xl bg-background/50 border-border/40"
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(answers[currentQIndex] || "").length} 字
                  </span>
                  <div className="flex gap-2">
                    {currentQIndex > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentQIndex(currentQIndex - 1)}
                      >
                        ← 上一题
                      </Button>
                    )}
                    {currentQIndex < questions.length - 1 ? (
                      <Button
                        size="sm"
                        onClick={() => setCurrentQIndex(currentQIndex + 1)}
                        disabled={!answers[currentQIndex]?.trim()}
                      >
                        下一题 →
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!allAnswered}
                        className="glow-primary"
                      >
                        提交全部答案
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {allAnswered && (
                <Button
                  className="w-full h-12 text-base font-medium rounded-xl glow-primary"
                  onClick={handleSubmit}
                >
                  提交检测 ({answeredCount}/{questions.length} 题已答)
                </Button>
              )}
            </>
          )}

          {viewState === "assessing" && (
            <div className="flex flex-col items-center justify-center py-24 space-y-10">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-3 border-primary/15 border-t-primary animate-spin" />
                <div className="absolute inset-3 rounded-full bg-gradient-to-br from-primary/10 to-transparent animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">🧪</span>
                </div>
              </div>
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold gradient-text">AI 正在评估你的回答</h2>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  逐题分析你的理解深度和准确性
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewState === "result" && result && (
            <div className="space-y-6">
              <div className={`glass-card rounded-xl overflow-hidden ${
                result.passed ? "border-green-500/30" : "border-amber-500/30"
              }`}>
                <div className={`h-1 ${result.passed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-orange-400"}`} />
                <div className="p-6 space-y-6">
                  <div className="text-center pb-2">
                    <div className="text-5xl mb-3">
                      {result.passed ? "🎉" : "💪"}
                    </div>
                    <h2 className="text-2xl font-bold gradient-text">
                      {result.passed ? "恭喜通过！" : "继续加油！"}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      综合评分: <span className="text-primary font-semibold">{Math.round(result.score_overall)}</span> / 100
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <ScoreBar label="知识覆盖" score={result.score_coverage} threshold={80} />
                    <ScoreBar label="理解深度" score={result.score_depth} />
                    <ScoreBar label="表达准确" score={result.score_accuracy} />
                  </div>

                  <div className="h-px bg-border/30" />

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span>📝</span> 评估反馈
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.feedback}
                    </p>
                  </div>

                  {!result.passed && result.missing_topics.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <span>⚠️</span> 需要加强的知识点
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {result.missing_topics.map((topic) => (
                          <Badge key={topic} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {!result.passed && result.suggestions.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <span>📎</span> 推荐学习资料
                      </h3>
                      <div className="space-y-2">
                        {result.suggestions.map((suggestion, i) => (
                          <div
                            key={i}
                            className="text-sm text-muted-foreground p-3.5 rounded-xl bg-background/30 border border-border/20"
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    {result.passed ? (
                      <Button
                        className="flex-1 h-12 rounded-xl glow-primary font-medium"
                        onClick={() => router.push(`/plan/${planId}`)}
                      >
                        返回关卡地图 →
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="h-12 rounded-xl border-border/50 px-6"
                          onClick={() => router.push(`/plan/${planId}/stage/${stageId}`)}
                        >
                          ← 回去复习
                        </Button>
                        <Button
                          className="flex-1 h-12 rounded-xl glow-primary font-medium"
                          onClick={() => {
                            setViewState("questions");
                            setResult(null);
                            setAnswers({});
                            setCurrentQIndex(0);
                          }}
                        >
                          重新答题
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  threshold,
}: {
  label: string;
  score: number;
  threshold?: number;
}) {
  const rounded = Math.round(score);
  const isLow = threshold ? rounded < threshold : rounded < 70;

  return (
    <div className="text-center space-y-2.5 p-3 rounded-xl bg-background/20 border border-border/20">
      <div className="text-3xl font-bold">
        <span className={isLow ? "text-amber-400" : "text-green-400"}>
          {rounded}
        </span>
      </div>
      <Progress value={rounded} className="h-1.5" />
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
