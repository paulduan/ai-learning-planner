"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Award,
  FileText,
  Palette,
  Upload,
  Loader2,
  Copy,
  Download,
  ExternalLink,
  FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportRecord {
  id: string;
  plan_id: string;
  export_type: string;
  file_path: string;
  created_at: string;
}

interface Plan {
  id: string;
  title: string;
  status: string;
}

interface StageProject {
  id: string;
  status: string;
}

type ExportType = "certificate" | "resume" | "portfolio";

interface PreviewState {
  type: ExportType;
  content: string;
  file_path: string;
}

const EXPORT_OPTIONS: {
  type: ExportType;
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  accent: string;
  borderGradient: string;
  iconBg: string;
}[] = [
  {
    type: "certificate",
    icon: <Award className="w-6 h-6" />,
    title: "完成证书",
    description: "生成精美的学习证书",
    buttonLabel: "生成证书",
    accent: "text-emerald-400",
    borderGradient:
      "from-emerald-500/40 via-emerald-400/20 to-transparent hover:from-emerald-500/60",
    iconBg: "bg-emerald-500/15 text-emerald-400",
  },
  {
    type: "resume",
    icon: <FileText className="w-6 h-6" />,
    title: "简历片段",
    description: "适合简历的学习经历",
    buttonLabel: "生成简历",
    accent: "text-blue-400",
    borderGradient:
      "from-blue-500/40 via-blue-400/20 to-transparent hover:from-blue-500/60",
    iconBg: "bg-blue-500/15 text-blue-400",
  },
  {
    type: "portfolio",
    icon: <Palette className="w-6 h-6" />,
    title: "作品集",
    description: "展示所有项目成果",
    buttonLabel: "生成作品集",
    accent: "text-purple-400",
    borderGradient:
      "from-purple-500/40 via-purple-400/20 to-transparent hover:from-purple-500/60",
    iconBg: "bg-purple-500/15 text-purple-400",
  },
];

const TYPE_LABELS: Record<string, string> = {
  certificate: "certificate",
  resume: "resume",
  portfolio: "portfolio",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileExtension(type: ExportType): string {
  return type === "resume" ? "md" : "html";
}

export default function ExportCenterPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<ExportType | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [completedProjectCount, setCompletedProjectCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const planCompleted = plan?.status === "completed";

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/export?plan_id=${planId}`);
      if (!res.ok) throw new Error("加载导出记录失败");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      toast.error("加载导出记录失败");
    }
  }, [planId]);

  const loadData = useCallback(async () => {
    try {
      const [planRes, projectsRes] = await Promise.all([
        fetch(`/api/plan?id=${planId}`),
        fetch(`/api/project?plan_id=${planId}`),
      ]);

      const planData = await planRes.json();
      if (planData?.plan) {
        setPlan(planData.plan);
      }

      const projects: StageProject[] = await projectsRes.json();
      const completed = Array.isArray(projects)
        ? projects.filter((p) => p.status === "completed").length
        : 0;
      setCompletedProjectCount(completed);

      await fetchHistory();
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [planId, fetchHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleGenerate(type: ExportType) {
    if (type === "portfolio" && completedProjectCount === 0) return;

    setGenerating(type);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, type }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "生成失败");
      }

      const data = await res.json();
      setPreview({
        type,
        content: data.content,
        file_path: data.file_path,
      });
      setPreviewOpen(true);
      await fetchHistory();
      toast.success("生成成功");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(null);
    }
  }

  function handleSaveToLocal() {
    if (!preview) return;

    const ext = getFileExtension(preview.type);
    const mime =
      preview.type === "resume" ? "text/markdown" : "text/html";
    const blob = new Blob([preview.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview.type}_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("已保存到本地");
  }

  async function handleCopyContent() {
    if (!preview) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(preview.content);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    } finally {
      setCopying(false);
    }
  }

  function handleOpenFile(filePath: string) {
    toast.info(`文件路径: ${filePath}`, {
      description: "桌面应用中可直接打开该路径",
      duration: 5000,
    });
    navigator.clipboard.writeText(filePath).catch(() => {});
  }

  function getPreviewTitle(type: ExportType): string {
    switch (type) {
      case "certificate":
        return "学习证书预览";
      case "resume":
        return "简历片段预览";
      case "portfolio":
        return "作品集预览";
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

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-emerald-500/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="app-region-drag shrink-0 border-b border-border/40 bg-card/40 backdrop-blur-md pl-20 pr-6 py-3.5 flex items-center gap-3 relative z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/plan/${planId}`)}
          className="app-region-no-drag text-muted-foreground hover:text-foreground"
        >
          ← 返回计划
        </Button>
        <h1 className="text-base font-semibold truncate flex items-center gap-2">
          <Upload className="w-4 h-4 text-muted-foreground" />
          导出中心
        </h1>
        {plan && (
          <Badge variant="outline" className="app-region-no-drag ml-auto text-xs">
            {plan.title}
          </Badge>
        )}
      </header>

      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Export Options */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-4">
              导出选项
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {EXPORT_OPTIONS.map((option) => {
                const isGenerating = generating === option.type;
                const isPortfolioDisabled =
                  option.type === "portfolio" && completedProjectCount === 0;

                return (
                  <div
                    key={option.type}
                    className={cn(
                      "glass-card rounded-xl p-[1px] bg-gradient-to-br transition-all",
                      option.borderGradient,
                      isPortfolioDisabled && "opacity-50"
                    )}
                  >
                    <div className="glass-card rounded-[11px] h-full p-5 flex flex-col">
                      <div
                        className={cn(
                          "w-11 h-11 rounded-lg flex items-center justify-center mb-4",
                          option.iconBg
                        )}
                      >
                        {option.icon}
                      </div>
                      <h3
                        className={cn(
                          "text-base font-semibold mb-1.5",
                          option.accent
                        )}
                      >
                        {option.title}
                      </h3>
                      <p className="text-sm text-muted-foreground flex-1 mb-5">
                        {option.description}
                      </p>
                      {option.type === "certificate" && !planCompleted && (
                        <p className="text-xs text-amber-400/80 mb-3">
                          计划进行中，证书将带有「进行中」水印
                        </p>
                      )}
                      {isPortfolioDisabled && (
                        <p className="text-xs text-muted-foreground/70 mb-3">
                          暂无已完成的项目
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="w-full app-region-no-drag"
                        disabled={isGenerating || isPortfolioDisabled}
                        onClick={() => handleGenerate(option.type)}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          option.buttonLabel
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Export History */}
          <Card className="glass-card border-border/40 bg-transparent ring-0">
            <CardHeader>
              <CardTitle className="text-base">导出记录</CardTitle>
              <CardDescription>
                查看历史导出文件，共 {history.length} 条记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <FileIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  暂无导出记录，点击上方按钮开始生成
                </div>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden">
                  {history.map((record) => {
                    const typeConfig = EXPORT_OPTIONS.find(
                      (o) => o.type === record.export_type
                    );
                    return (
                      <div
                        key={record.id}
                        className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors"
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                            typeConfig?.iconBg ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          <FileIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {TYPE_LABELS[record.export_type] ??
                                record.export_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              — {formatDate(record.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground/70 mt-1 truncate font-mono">
                            {record.file_path}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 app-region-no-drag text-xs"
                          onClick={() => handleOpenFile(record.file_path)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          打开文件
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {preview ? getPreviewTitle(preview.type) : "预览生成的内容"}
            </DialogTitle>
            <DialogDescription>
              预览生成结果，确认后可保存到本地或复制内容
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
              {preview.type === "certificate" && !planCompleted && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-400 text-[10px]"
                  >
                    进行中
                  </Badge>
                  学习计划尚未完成，此证书仅供预览参考
                </div>
              )}

              <div className="flex-1 min-h-0 rounded-lg border border-border/40 overflow-hidden bg-white/5 relative">
                {preview.type === "resume" ? (
                  <pre className="h-[50vh] overflow-auto p-4 text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
                    {preview.content}
                  </pre>
                ) : (
                  <div className="relative h-[50vh]">
                    {!planCompleted && preview.type === "certificate" && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <span className="text-6xl font-bold text-foreground/8 rotate-[-20deg] select-none">
                          进行中
                        </span>
                      </div>
                    )}
                    <iframe
                      srcDoc={preview.content}
                      title="Export preview"
                      className="w-full h-full border-0 bg-white"
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </div>

              {preview.file_path && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  保存路径: {preview.file_path}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleSaveToLocal}
              disabled={!preview}
              className="app-region-no-drag"
            >
              <Download className="w-4 h-4" />
              保存到本地
            </Button>
            <Button
              onClick={handleCopyContent}
              disabled={!preview || copying}
              className="app-region-no-drag"
            >
              {copying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              复制内容
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
