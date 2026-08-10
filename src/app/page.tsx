"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PlanData {
  plan: { id: string; status: string };
  stages: { id: string }[];
}

export default function HomePage() {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOk, setConfigOk] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [planRes, configRes] = await Promise.all([
          fetch("/api/plan"),
          fetch("/api/config"),
        ]);
        const planData = await planRes.json();
        const configData = await configRes.json();
        setActivePlan(planData);
        setConfigOk(!!configData?.llm_api_key && configData.llm_api_key !== "");
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (activePlan?.plan) {
      router.push(`/plan/${activePlan.plan.id}`);
    }
  }, [activePlan, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-2 rounded-full bg-primary/5 animate-pulse" />
          </div>
          <span className="text-sm text-muted-foreground animate-pulse">加载中...</span>
        </div>
      </div>
    );
  }

  if (!configOk) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-primary/8 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-radial from-chart-2/5 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/6 w-[300px] h-[300px] bg-gradient-radial from-chart-4/5 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md space-y-10">
          <div className="text-center space-y-5">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/10 shadow-lg glow-primary">
              <span className="text-5xl drop-shadow-lg">🎯</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight gradient-text">
                精细化 AI 规划
              </h1>
              <p className="text-muted-foreground mt-3 text-base leading-relaxed max-w-sm mx-auto">
                AI 驱动的个性化学习教练
                <br />
                <span className="text-primary/90 font-medium">目标 → 规划 → 学习 → 检测 → 通关</span>
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <span className="text-lg shrink-0">⚡</span>
              <div className="text-sm text-amber-200/80 leading-relaxed">
                首次使用需配置 API Key
                <span className="text-muted-foreground"> — 支持 OpenAI / Anthropic / DeepSeek</span>
              </div>
            </div>

            <div className="space-y-3.5">
              {[
                { num: 1, text: "配置 API Key 和网络代理", icon: "⚙️" },
                { num: 2, text: "选择学习目标，AI 生成个性化计划", icon: "🗺️" },
                { num: 3, text: "按阶段学习，通过检测解锁下一关", icon: "🔓" },
              ].map((step) => (
                <div key={step.num} className="flex items-center gap-3.5 text-sm group">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-xs font-bold text-primary border border-primary/10 shrink-0">
                    {step.num}
                  </div>
                  <span className="text-foreground/80 group-hover:text-foreground transition-colors">{step.icon} {step.text}</span>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-12 font-medium text-base rounded-xl glow-primary transition-all hover:scale-[1.01]"
              size="lg"
              onClick={() => router.push("/settings")}
            >
              开始配置
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (activePlan?.plan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-sm text-muted-foreground animate-pulse">跳转中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* 品牌区 */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/10">
              <span className="text-4xl">🎯</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">精细化 AI 规划</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                不是传统网课，而是 AI 一对一教练
              </p>
            </div>
          </div>

          {/* 产品特色 */}
          <div className="space-y-3">
            {[
              { icon: "💬", title: "对话式学习", desc: "AI 通过提问引导你思考，不是单向灌输" },
              { icon: "🎯", title: "目标导向", desc: "从你的真实目标出发，定制个性化学习路线" },
              { icon: "🔍", title: "真实数据", desc: "资料来自网络搜索，不是 AI 编造的链接" },
              { icon: "✍️", title: "闯关检测", desc: "每个阶段必须通过检测，确保真正学会了" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-3.5 rounded-xl border border-border/20 bg-card/30">
                <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 行动按钮 */}
          <div className="space-y-2.5">
            <Button
              className="w-full h-12 text-base font-medium rounded-xl"
              onClick={() => router.push("/plan/new")}
            >
              开始学习 →
            </Button>
            <Button
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground"
              onClick={() => router.push("/settings")}
            >
              ⚙️ 系统设置
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/50">
            可学习任何领域 — 技术、投资、语言、商业、人文...
          </p>
        </div>
      </main>
    </div>
  );
}
