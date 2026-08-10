"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ChatMsg {
  role: string;
  content: string;
}

type InterviewStyle = "friendly" | "standard" | "tough";

const STYLES: { id: InterviewStyle; icon: string; name: string; desc: string }[] = [
  { id: "friendly", icon: "😊", name: "友善引导", desc: "像和同事聊天，轻松愉快" },
  { id: "standard", icon: "👔", name: "标准技术面", desc: "模拟真实面试流程" },
  { id: "tough", icon: "🔥", name: "压力面试", desc: "深挖细节，持续追问" },
];

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [style, setStyle] = useState<InterviewStyle | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [planTitle, setPlanTitle] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/plan?id=${planId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.plan?.title) setPlanTitle(data.plan.title);
      })
      .catch(() => {});
  }, [planId]);

  const loadHistory = useCallback(async (s: InterviewStyle) => {
    try {
      const res = await fetch(`/api/plan/${planId}/interview?style=${s}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    }
  }, [planId]);

  useEffect(() => {
    if (style) loadHistory(style);
  }, [style, loadHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startInterview(s: InterviewStyle) {
    setStyle(s);
    const res = await fetch(`/api/plan/${planId}/interview?style=${s}`);
    const data = await res.json();
    const history = Array.isArray(data) ? data : [];

    if (history.length === 0) {
      setSending(true);
      try {
        const chatRes = await fetch(`/api/plan/${planId}/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "开始面试", style: s }),
        });
        const reply = await chatRes.json();
        setMessages([
          { role: "user", content: "开始面试" },
          { role: "assistant", content: reply.content },
        ]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSending(false);
      }
    } else {
      setMessages(history);
    }
  }

  async function handleSend() {
    if (!input.trim() || sending || !style) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setSending(true);

    try {
      const res = await fetch(`/api/plan/${planId}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, style }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "发送失败");
      }
      const reply = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply.content }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleReset() {
    if (!style) return;
    try {
      await fetch(`/api/plan/${planId}/interview?style=${style}`, { method: "DELETE" });
      setMessages([]);
      setStyle(null);
      toast.success("面试已重置");
    } catch {
      toast.error("重置失败");
    }
  }

  if (!style) {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-primary/6 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <header className="border-b border-border/40 px-6 py-4 bg-card/40 backdrop-blur-md relative z-10">
          <div className="max-w-3xl mx-auto flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/plan/${planId}`)} className="text-muted-foreground hover:text-foreground">
              ← 返回
            </Button>
            <h1 className="text-lg font-semibold">模拟面试</h1>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 relative z-10">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <span className="text-4xl">🎙️</span>
              </div>
              <h2 className="text-3xl font-bold gradient-text">AI 模拟面试</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                基于你学习的「{planTitle || "..."}」内容，AI 面试官将对你进行技术面试
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">选择面试官风格</p>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  className="w-full glass-card rounded-xl p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 group"
                  onClick={() => startInterview(s.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10 shrink-0 group-hover:scale-105 transition-transform">
                      <span className="text-2xl">{s.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold">{s.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                    <span className="text-muted-foreground/50 group-hover:text-primary transition-colors">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentStyle = STYLES.find((s) => s.id === style)!;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40 px-6 py-3 bg-card/40 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/plan/${planId}`)} className="text-muted-foreground hover:text-foreground shrink-0">
            ← 返回
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{currentStyle.icon}</span>
            <span className="text-sm font-medium truncate">{currentStyle.name}</span>
            <Badge variant="outline" className="text-[10px] border-border/30 shrink-0">
              {planTitle}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setStyle(null); }}>
              换风格
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-destructive/70 hover:text-destructive" onClick={handleReset}>
              重新开始
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.filter(m => m.content !== "开始面试").map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary/10 border border-primary/20 text-foreground"
                  : "glass-card"
              }`}>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                    <span>{currentStyle.icon}</span>
                    <span>{currentStyle.name}</span>
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="glass-card rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                  <span>{currentStyle.icon}</span>
                  <span>{currentStyle.name}</span>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="border-t border-border/40 px-6 py-4 bg-card/40 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Textarea
            ref={inputRef}
            placeholder="输入你的回答..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            className="flex-1 rounded-xl bg-background/50 border-border/40 focus:border-primary/50 resize-none text-sm"
            disabled={sending}
          />
          <Button
            className="h-auto rounded-xl px-6 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            发送
          </Button>
        </div>
      </footer>
    </div>
  );
}
