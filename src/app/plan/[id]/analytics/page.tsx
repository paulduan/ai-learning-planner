"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Lightbulb,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CHART_COLORS = {
  primary: "#818cf8",
  secondary: "#a78bfa",
  grid: "#1e293b",
  text: "#94a3b8",
  tooltip_bg: "#1e1b4b",
};

interface PlanStats {
  stageProgress: number;
  completedStages: number;
  totalStages: number;
  assessmentPassRate: number;
  reviewCompletionRate: number;
  dueReviewCount: number;
  projectCompletionRate: number;
  completedProjects: number;
  totalProjects: number;
  totalStudyMinutes: number;
}

interface DailyPoint {
  date: string;
  minutes: number;
}

interface HourlyPoint {
  hour: number;
  total_minutes: number;
  avg_score: number | null;
}

interface Stage {
  id: string;
  order_index: number;
  title: string;
  status: string;
  resource_completion_rate: number;
}

interface Plan {
  id: string;
  title: string;
  daily_hours: number;
}

type Period = 7 | 30;

function formatStudyHours(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = minutes / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fillHourlyData(data: HourlyPoint[]): HourlyPoint[] {
  const map = new Map(data.map((d) => [d.hour, d.total_minutes]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total_minutes: map.get(hour) ?? 0,
    avg_score: null,
  }));
}

function getBarColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return CHART_COLORS.grid;
  const ratio = value / max;
  if (ratio >= 0.75) return CHART_COLORS.secondary;
  if (ratio >= 0.4) return CHART_COLORS.primary;
  return "#6366f1";
}

function getPeakHourInsight(data: HourlyPoint[]): string | null {
  const filled = fillHourlyData(data);
  const maxMinutes = Math.max(...filled.map((d) => d.total_minutes));
  if (maxMinutes <= 0) return null;

  const peakHours = filled
    .filter((d) => d.total_minutes === maxMinutes)
    .map((d) => d.hour)
    .sort((a, b) => a - b);

  if (peakHours.length === 0) return null;

  const start = peakHours[0];
  const end = peakHours[peakHours.length - 1];

  const periodLabel = (hour: number) => {
    if (hour >= 5 && hour < 12) return "上午";
    if (hour >= 12 && hour < 18) return "下午";
    if (hour >= 18 && hour < 23) return "晚上";
    return "凌晨";
  };

  if (start === end) {
    return `你在${periodLabel(start)} ${start}:00 左右学习效率最高`;
  }
  return `你在${periodLabel(start)} ${start}-${end} 点学习效率最高`;
}

function getStageMastery(stage: Stage): number {
  if (stage.status === "completed") return 100;
  if (stage.status === "locked") return 0;
  return Math.round((stage.resource_completion_rate ?? 0) * 100);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string | number;
  unit?: string;
  labelFormatter?: (label: string | number) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit = "分钟",
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const displayLabel = labelFormatter && label != null
    ? labelFormatter(label)
    : String(label ?? "");
  return (
    <div
      className="rounded-lg border border-white/10 px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: CHART_COLORS.tooltip_bg, color: "#e2e8f0" }}
    >
      {displayLabel && <p className="mb-1 text-slate-400">{displayLabel}</p>}
      <p className="font-medium text-indigo-200">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "border-white/10 bg-white/5 shadow-none ring-0 backdrop-blur-md",
        className
      )}
    >
      {children}
    </Card>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PlanStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyPoint[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [period, setPeriod] = useState<Period>(7);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, dailyRes, hourlyRes, planRes] = await Promise.all([
        fetch(`/api/analytics?plan_id=${planId}&type=overview`),
        fetch(`/api/analytics?plan_id=${planId}&type=daily`),
        fetch(`/api/analytics?plan_id=${planId}&type=hourly`),
        fetch(`/api/plan?id=${planId}`),
      ]);

      const [overviewJson, dailyJson, hourlyJson, planJson] = await Promise.all([
        overviewRes.json(),
        dailyRes.json(),
        hourlyRes.json(),
        planRes.json(),
      ]);

      setOverview(overviewJson);
      setDailyData(Array.isArray(dailyJson) ? dailyJson : []);
      setHourlyData(Array.isArray(hourlyJson) ? hourlyJson : []);
      if (planJson?.plan) {
        setPlan(planJson.plan);
        setStages(planJson.stages ?? []);
      }
    } catch {
      setOverview(null);
      setDailyData([]);
      setHourlyData([]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDaily = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    cutoff.setHours(0, 0, 0, 0);
    return dailyData.filter((d) => new Date(`${d.date}T00:00:00`) >= cutoff);
  }, [dailyData, period]);

  const hourlyChartData = useMemo(() => fillHourlyData(hourlyData), [hourlyData]);
  const maxHourlyMinutes = useMemo(
    () => Math.max(...hourlyChartData.map((d) => d.total_minutes), 0),
    [hourlyChartData]
  );
  const peakInsight = useMemo(() => getPeakHourInsight(hourlyData), [hourlyData]);
  const hasEnoughHourlyData = dailyData.length >= 7;
  const dailyGoalMinutes = (plan?.daily_hours ?? 1) * 60;
  const isEmpty = !overview || overview.totalStudyMinutes === 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
          <span className="text-sm text-muted-foreground">加载分析数据...</span>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="app-region-drag border-b border-border/40 pl-20 pr-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="app-region-no-drag text-muted-foreground hover:text-foreground"
              onClick={() => router.push(`/plan/${planId}`)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              返回计划
            </Button>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              学习洞察
            </h1>
          </div>
        </header>
        <main className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <span className="mb-4 text-5xl">📊</span>
          <h2 className="mb-2 text-xl font-semibold">开始第一次学习</h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            完成学习会话后，这里会展示你的时长趋势、最佳学习时段和知识掌握分布。
          </p>
          <Button
            className="app-region-no-drag rounded-lg"
            onClick={() => router.push(`/plan/${planId}`)}
          >
            前往学习
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="app-region-drag border-b border-border/40 pl-20 pr-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="app-region-no-drag text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`/plan/${planId}`)}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回计划
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            学习洞察
          </h1>
          {plan?.title && (
            <Badge variant="secondary" className="ml-auto bg-white/5 text-xs text-muted-foreground">
              {plan.title}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GlassCard>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                总学习时长
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatStudyHours(overview!.totalStudyMinutes)}
              </p>
            </CardContent>
          </GlassCard>

          <GlassCard>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                计划进度
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {overview!.completedStages}/{overview!.totalStages}
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({formatPercent(overview!.stageProgress)})
                </span>
              </p>
            </CardContent>
          </GlassCard>

          <GlassCard>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                评估通过率
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatPercent(overview!.assessmentPassRate)}
              </p>
            </CardContent>
          </GlassCard>

          <GlassCard>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                复习完成率
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatPercent(overview!.reviewCompletionRate)}
              </p>
            </CardContent>
          </GlassCard>
        </div>

        {/* Study Time Trend */}
        <GlassCard>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">学习时长趋势</CardTitle>
            <div className="app-region-no-drag flex gap-1">
              {([7, 30] as Period[]).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 rounded-md px-3 text-xs",
                    period !== p && "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setPeriod(p)}
                >
                  {p}天
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredDaily.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                该时段暂无学习记录
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={filteredDaily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} />
                      <stop offset="100%" stopColor={CHART_COLORS.secondary} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    stroke={CHART_COLORS.text}
                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={CHART_COLORS.text}
                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        unit="分钟"
                        labelFormatter={(label) => formatDateLabel(String(label))}
                      />
                    }
                  />
                  <ReferenceLine
                    y={dailyGoalMinutes}
                    stroke={CHART_COLORS.secondary}
                    strokeDasharray="6 4"
                    label={{
                      value: `目标 ${plan?.daily_hours ?? 1}h`,
                      fill: CHART_COLORS.text,
                      fontSize: 11,
                      position: "insideTopRight",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke="url(#lineGradient)"
                    strokeWidth={2.5}
                    dot={{ fill: CHART_COLORS.primary, strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: CHART_COLORS.secondary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>

        {/* Best Study Hours */}
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base">最佳学习时段</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasEnoughHourlyData ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                数据不足 — 需要至少 7 天的学习记录才能分析时段分布
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hourlyChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}`}
                      stroke={CHART_COLORS.text}
                      tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      stroke={CHART_COLORS.text}
                      tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          unit="分钟"
                          labelFormatter={(h) => `${h}:00 - ${Number(h) + 1}:00`}
                        />
                      }
                    />
                    <Bar dataKey="total_minutes" radius={[4, 4, 0, 0]}>
                      {hourlyChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getBarColor(entry.total_minutes, maxHourlyMinutes)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {peakInsight && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Lightbulb className="h-4 w-4 shrink-0 text-amber-400" />
                    {peakInsight}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </GlassCard>

        {/* Knowledge Mastery */}
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base">知识掌握分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无阶段数据</p>
            ) : (
              stages.map((stage) => {
                const mastery = getStageMastery(stage);
                const isLocked = stage.status === "locked";
                return (
                  <div key={stage.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Stage{stage.order_index + 1}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {stage.title}
                        </span>
                        {isLocked && (
                          <Badge
                            variant="secondary"
                            className="bg-white/5 text-[10px] text-muted-foreground"
                          >
                            locked
                          </Badge>
                        )}
                      </div>
                      <span
                        className={cn(
                          "tabular-nums",
                          isLocked ? "text-muted-foreground/50" : "text-foreground"
                        )}
                      >
                        {mastery}%
                      </span>
                    </div>
                    <Progress
                      value={mastery}
                      className={cn("h-2", isLocked && "opacity-40")}
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </GlassCard>
      </main>
    </div>
  );
}
