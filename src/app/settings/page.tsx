"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Config {
  llm_provider: string;
  llm_api_key: string;
  llm_base_url: string;
  llm_model: string;
  proxy_enabled: boolean;
  proxy_type: string;
  proxy_host: string;
  proxy_port: number;
  tavily_api_key: string;
  search_region: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<Config>({
    llm_provider: "openai",
    llm_api_key: "",
    llm_base_url: "",
    llm_model: "gpt-4o-mini",
    proxy_enabled: false,
    proxy_type: "http",
    proxy_host: "",
    proxy_port: 7890,
    tavily_api_key: "",
    search_region: "global",
  });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [tavilyKeyInput, setTavilyKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }> | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        llm_provider: config.llm_provider,
        llm_base_url: config.llm_base_url,
        llm_model: config.llm_model,
        proxy_enabled: config.proxy_enabled,
        proxy_type: config.proxy_type,
        proxy_host: config.proxy_host,
        proxy_port: config.proxy_port,
        search_region: config.search_region,
      };
      if (apiKeyInput) {
        payload.llm_api_key = apiKeyInput;
      }
      if (tavilyKeyInput) {
        payload.tavily_api_key = tavilyKeyInput;
      }
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("设置已保存");
      setApiKeyInput("");
      setTavilyKeyInput("");
      const res = await fetch("/api/config");
      setConfig(await res.json());
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResults(null);
    try {
      await handleSave();
      await new Promise((r) => setTimeout(r, 300));
      const res = await fetch("/api/config/test", { method: "POST" });
      const data = await res.json();
      setTestResults(data);
    } catch {
      toast.error("测试失败");
    } finally {
      setTesting(false);
    }
  }

  const modelOptions: Record<string, { label: string; value: string }[]> = {
    openai: [
      { label: "GPT-4o Mini (推荐)", value: "gpt-4o-mini" },
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
      { label: "GPT-4.1", value: "gpt-4.1" },
    ],
    anthropic: [
      { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
      { label: "Claude Haiku 3.5", value: "claude-3-5-haiku-20241022" },
    ],
    deepseek: [
      { label: "DeepSeek Chat (推荐)", value: "deepseek-chat" },
      { label: "DeepSeek Reasoner", value: "deepseek-reasoner" },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/40 px-6 py-4 bg-card/40 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground">
            ← 返回
          </Button>
          <h1 className="text-lg font-semibold">⚙️ 系统设置</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LLM 配置</CardTitle>
              <CardDescription>
                配置 AI 大模型，用于生成学习计划和检测评估
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>供应商</Label>
                <Select
                  value={config.llm_provider}
                  onValueChange={(v) => { if (v) setConfig({ ...config, llm_provider: v, llm_model: modelOptions[v]?.[0]?.value || "", llm_base_url: "" }); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder={config.llm_api_key || "输入 API Key..."}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
                {config.llm_api_key && (
                  <p className="text-xs text-muted-foreground">
                    当前已配置: {config.llm_api_key}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>模型</Label>
                <Select
                  value={config.llm_model}
                  onValueChange={(v) => { if (v) setConfig({ ...config, llm_model: v }); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelOptions[config.llm_provider] || []).map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>自定义 Base URL (可选)</Label>
                <Input
                  placeholder={
                    config.llm_provider === "deepseek"
                      ? "默认: https://api.deepseek.com/v1"
                      : config.llm_provider === "anthropic"
                        ? "默认: https://api.anthropic.com"
                        : "默认: https://api.openai.com/v1"
                  }
                  value={config.llm_base_url}
                  onChange={(e) => setConfig({ ...config, llm_base_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  留空使用默认地址，如使用代理或转发服务则在此填写
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔍 数据源配置</CardTitle>
              <CardDescription>
                配置搜索引擎 API，获取真实、可验证的学习资源
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tavily API Key</Label>
                <Input
                  type="password"
                  placeholder={config.tavily_api_key || "输入 Tavily API Key..."}
                  value={tavilyKeyInput}
                  onChange={(e) => setTavilyKeyInput(e.target.value)}
                />
                {config.tavily_api_key && (
                  <p className="text-xs text-muted-foreground">
                    当前已配置: {config.tavily_api_key}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  免费注册获取: <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">tavily.com</a> · 每月 1000 次免费搜索
                </p>
              </div>

              <div className="space-y-2">
                <Label>搜索区域偏好</Label>
                <Select
                  value={config.search_region}
                  onValueChange={(v) => { if (v) setConfig({ ...config, search_region: v }); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">全球 (推荐)</SelectItem>
                    <SelectItem value="cn">中国优先</SelectItem>
                    <SelectItem value="us">英文优先</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  配置 Tavily API 后，系统将使用真实搜索引擎获取学习资源，替代 AI 生成的不准确链接。未配置时仍使用 AI 生成（可能不准确）。
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>代理配置</CardTitle>
              <CardDescription>
                配置 VPN/代理以访问海外学习资源
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>启用代理</Label>
                <Button
                  variant={config.proxy_enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConfig({ ...config, proxy_enabled: !config.proxy_enabled })}
                >
                  {config.proxy_enabled ? "已启用" : "未启用"}
                </Button>
              </div>

              {config.proxy_enabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>协议</Label>
                      <Select
                        value={config.proxy_type}
                        onValueChange={(v) => { if (v) setConfig({ ...config, proxy_type: v }); }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="socks5">SOCKS5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>端口</Label>
                      <Input
                        type="number"
                        value={config.proxy_port}
                        onChange={(e) => setConfig({ ...config, proxy_port: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>主机地址</Label>
                    <Input
                      placeholder="127.0.0.1"
                      value={config.proxy_host}
                      onChange={(e) => setConfig({ ...config, proxy_host: e.target.value })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>连接测试</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleTest} disabled={testing} className="w-full">
                {testing ? "测试中..." : "测试连接"}
              </Button>
              {testResults && (
                <div className="space-y-2">
                  {Object.entries(testResults).map(([key, result]) => {
                    const displayNames: Record<string, string> = { llm: "LLM", proxy: "代理", tavily: "Tavily 搜索" };
                    return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm font-medium">{displayNames[key] || key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{result.message}</span>
                        <Badge variant={result.ok ? "default" : "destructive"}>
                          {result.ok ? "成功" : "失败"}
                        </Badge>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
