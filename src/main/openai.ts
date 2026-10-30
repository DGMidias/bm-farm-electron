import {
  formatOpenAiStatus,
  normalizeOpenAiBase,
  openaiReady,
  parseCreditFromCosts,
  parseModelsCount,
  sanitizeOpenAiKey,
} from "@shared/openai-view";
import type { ConnectionResult, OpenAiConfig } from "@shared/types";
import { logError } from "./log";

export { normalizeOpenAiBase, openaiReady, sanitizeOpenAiKey };

async function openaiRequest(
  config: OpenAiConfig,
  path: string,
  search?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: unknown; headers: Headers }> {
  const base = normalizeOpenAiBase(config.baseUrl);
  const url = new URL(path.replace(/^\//, ""), `${base}/`);
  if (search) {
    for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sanitizeOpenAiKey(config.apiKey)}`,
      Accept: "application/json",
    },
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json, headers: response.headers };
}

function errorMessage(json: unknown, status: number): string {
  const err = json && typeof json === "object" ? (json as { error?: { message?: string } }).error : undefined;
  return err?.message?.trim() || `OpenAI HTTP ${status}`;
}

export async function testOpenAi(config: OpenAiConfig): Promise<ConnectionResult> {
  if (!openaiReady(config)) return { ok: false, mensagem: "OpenAI sem API key." };
  try {
    const models = await openaiRequest(config, "/models");
    if (!models.ok) return { ok: false, mensagem: errorMessage(models.json, models.status) };
    const start = Math.floor(Date.now() / 1000) - 86_400;
    const costs = await openaiRequest(config, "/organization/costs", {
      start_time: String(start),
      limit: "1",
    }).catch(() => undefined);
    const credit = costs?.ok ? parseCreditFromCosts(costs.json) : undefined;
    const usageDenied = Boolean(costs && (costs.status === 401 || costs.status === 403) && !credit);
    return {
      ok: true,
      mensagem: formatOpenAiStatus({
        models: parseModelsCount(models.json),
        organization: models.headers.get("openai-organization") ?? undefined,
        credit,
        usageDenied,
        rateLimit: models.headers.get("x-ratelimit-remaining-requests") ?? undefined,
      }),
    };
  } catch (error) {
    logError("openai", error, "teste de conexão");
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha ao falar com a OpenAI." };
  }
}
