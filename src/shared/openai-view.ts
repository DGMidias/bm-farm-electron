export const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";

export function sanitizeOpenAiKey(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function normalizeOpenAiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed || OPENAI_DEFAULT_BASE;
}

export function openaiReady(config: { apiKey?: string; baseUrl?: string }): boolean {
  return Boolean(normalizeOpenAiBase(config.baseUrl ?? "") && sanitizeOpenAiKey(config.apiKey ?? ""));
}

export function parseModelsCount(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? data.length : undefined;
}

export function parseCreditFromCosts(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const rows = (payload as { data?: Array<{ amount?: { value?: number; currency?: string } }> }).data;
  const amount = rows?.[0]?.amount;
  if (typeof amount?.value !== "number") return undefined;
  const currency = (amount.currency ?? "usd").toUpperCase();
  return `${currency} ${amount.value.toFixed(2)}`;
}

export function formatOpenAiStatus(input: {
  models?: number;
  organization?: string;
  credit?: string;
  usageDenied?: boolean;
  rateLimit?: string;
}): string {
  const parts = ["OpenAI autenticada"];
  if (input.organization?.trim()) parts.push(`org ${input.organization.trim()}`);
  if (typeof input.models === "number") {
    parts.push(`${input.models} modelo${input.models === 1 ? "" : "s"}`);
  }
  if (input.credit?.trim()) parts.push(`crédito ${input.credit.trim()}`);
  else if (input.usageDenied) parts.push("saldo só com chave de admin da org");
  if (input.rateLimit?.trim()) parts.push(`rate ${input.rateLimit.trim()}`);
  return parts.join(" · ");
}
