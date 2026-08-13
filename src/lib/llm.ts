import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { getConfig } from "@/db/queries";

export const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  deepseek: "https://api.deepseek.com/v1",
  kimi: "https://api.moonshot.cn/v1",
};

export function isOpenAICompatibleStructuredFallback() {
  const provider = getConfig().llm_provider;
  return provider === "deepseek" || provider === "kimi";
}

export function getModel() {
  const config = getConfig();
  if (!config.llm_api_key) {
    throw new Error("请先在设置页面配置 API Key");
  }

  if (config.llm_provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: config.llm_api_key,
      ...(config.llm_base_url ? { baseURL: config.llm_base_url } : {}),
    });
    return anthropic(config.llm_model || "claude-sonnet-4-20250514");
  }

  if (config.llm_provider === "deepseek") {
    const deepseek = createOpenAI({
      apiKey: config.llm_api_key,
      baseURL: config.llm_base_url || PROVIDER_DEFAULT_BASE_URLS.deepseek,
    });
    return deepseek.chat(config.llm_model || "deepseek-chat");
  }

  if (config.llm_provider === "kimi") {
    const kimi = createOpenAI({
      apiKey: config.llm_api_key,
      baseURL: config.llm_base_url || PROVIDER_DEFAULT_BASE_URLS.kimi,
    });
    return kimi.chat(config.llm_model || "kimi-k2-0711-preview");
  }

  const openai = createOpenAI({
    apiKey: config.llm_api_key,
    ...(config.llm_base_url ? { baseURL: config.llm_base_url } : {}),
  });
  return openai(config.llm_model || "gpt-4o-mini");
}
