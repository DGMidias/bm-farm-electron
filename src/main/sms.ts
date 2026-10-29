import {
  activationOwnerLabel,
  canCancelActivation,
  defaultSmsOption,
  diffActivationChanges,
  extractActivationList,
  formatActivationWhen,
  formatExpiry,
  formatRestClock,
  formatSmsOptionLabel,
  latestSms,
  mapSmsServices,
  mergeSeenActivations,
  nationalPhone,
  optionAllowsDdd,
  resolveSmsSelection,
  sortSmsServices,
  unwrapActivationPayload,
} from "@shared/sms-view";
import type { ConnectionResult, SmsActivation, SmsConfig, SmsService, SmsServiceOption } from "@shared/types";
import { log, logError } from "./log";

export {
  activationOwnerLabel,
  canCancelActivation,
  defaultSmsOption,
  diffActivationChanges,
  extractActivationList,
  formatActivationWhen,
  formatExpiry,
  formatRestClock,
  formatSmsOptionLabel,
  latestSms,
  mapSmsServices,
  mergeSeenActivations,
  nationalPhone,
  optionAllowsDdd,
  resolveSmsSelection,
  sortSmsServices,
  unwrapActivationPayload,
};

export function normalizeSmsBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (!trimmed) return "https://app.numero-virtual.com/api/v1";
  if (/api\.numero-virtual\.app/i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }
  if (/app\.numero-virtual\.com(\.br)?/i.test(trimmed)) {
    return "https://app.numero-virtual.com/api/v1";
  }
  return trimmed;
}

export function smsFlavor(baseUrl: string): "com" | "app" {
  return /numero-virtual\.app/i.test(normalizeSmsBase(baseUrl)) ? "app" : "com";
}

export function sanitizeSmsKey(raw: string): string {
  const compact = raw.trim().replace(/\s+/g, "");
  if (/^nv_live[_-]/i.test(compact)) {
    const rest = compact.replace(/^nv_live[_-]/i, "");
    const next = rest.search(/nv_live[_-]/i);
    const body = (next === -1 ? rest : rest.slice(0, next)).replace(/[^A-Za-z0-9_-]+$/g, "");
    return `nv_live_${body}`;
  }
  return compact;
}

export function smsAuthHeaders(apiKey: string): Record<string, string> {
  const key = sanitizeSmsKey(apiKey);
  return {
    Authorization: `Bearer ${key}`,
    "x-api-key": key,
    Accept: "application/json",
    "content-type": "application/json",
  };
}

export function normalizeSmsCountry(code: string, flavor: "com" | "app"): string {
  const raw = code.trim().toUpperCase();
  if (flavor === "com") return raw === "BRA" || !raw ? "BR" : raw;
  return raw === "BR" || !raw ? "BRA" : raw;
}

export function smsReady(config: SmsConfig): boolean {
  return Boolean(config.baseUrl.trim() && sanitizeSmsKey(config.apiKey));
}

export function isHtmlBody(text: string): boolean {
  const start = text.trimStart().slice(0, 15).toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html");
}

export function normalizeDdd(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 3 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 2) return digits;
  return "";
}

export function dddFromPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 6) return digits.slice(2, 4);
  if (digits.length >= 4) return digits.slice(0, 2);
  return undefined;
}

export function rememberActivation(list: SmsActivation[] | undefined, item: SmsActivation): SmsActivation[] {
  if (!item.id) return list ?? [];
  const next = [item, ...(list ?? []).filter((row) => row.id !== item.id)];
  return next.slice(0, 100);
}

function firstString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value == null || value === "") continue;
    if (typeof value === "object") {
      const nested = firstString(value as Record<string, unknown>, ["name", "phone", "number", "code", "id"]);
      if (nested) return nested;
      continue;
    }
    return String(value);
  }
  return "";
}

export function buildCreateBody(
  config: SmsConfig,
  option?: Pick<SmsServiceOption, "allowsDdd">,
): { serviceId: number; country: string; ddd?: string; apiId?: number } {
  const serviceId = Number(config.serviceId);
  if (!Number.isFinite(serviceId) || serviceId <= 0) {
    throw new Error("Informe o serviceId do Facebook (60033) ou escolha um serviço na lista.");
  }
  const body: { serviceId: number; country: string; ddd?: string; apiId?: number } = {
    serviceId,
    country: normalizeSmsCountry(config.countryCode, "com"),
  };
  const apiId = Number(config.apiId);
  if (Number.isFinite(apiId) && apiId > 0) body.apiId = apiId;
  const ddd = normalizeDdd(config.ddd);
  if (ddd && option?.allowsDdd !== false) body.ddd = ddd;
  return body;
}

interface NvEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string } | string;
}

function errorMessage(payload: NvEnvelope<unknown>, fallback: string): string {
  if (typeof payload.error === "string" && payload.error) return payload.error;
  if (payload.error && typeof payload.error === "object" && payload.error.message) return payload.error.message;
  return fallback;
}

async function nvRequest<T>(config: SmsConfig, path: string, init?: RequestInit): Promise<T> {
  if (!smsReady(config)) {
    throw new Error("SMS só é usado quando URL e API key estão configuradas.");
  }
  const url = new URL(path.replace(/^\//, ""), `${normalizeSmsBase(config.baseUrl)}/`);
  log("info", "sms", `${init?.method ?? "GET"} ${url.pathname}`);
  const response = await fetch(url, {
    ...init,
    headers: {
      ...smsAuthHeaders(config.apiKey),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  if (isHtmlBody(text)) {
    log("warn", "sms", `HTML no lugar de JSON (${response.status}) ${url.pathname}`);
    throw new Error("A URL devolveu o site, não a API. Use Authorization Bearer e rotas /balance, /services, /activations.");
  }
  let payload: NvEnvelope<T>;
  try {
    payload = JSON.parse(text) as NvEnvelope<T>;
  } catch {
    log("error", "sms", `resposta inválida HTTP ${response.status} em ${url.pathname}`);
    throw new Error(`SMS HTTP ${response.status}: resposta inválida.`);
  }
  if (payload.error) {
    const message = errorMessage(payload, `SMS HTTP ${response.status}.`);
    log("error", "sms", `${url.pathname} → ${message}`, { status: response.status });
    throw new Error(message);
  }
  if (!response.ok) {
    log("error", "sms", `${url.pathname} HTTP ${response.status}`);
    throw new Error(`SMS HTTP ${response.status}.`);
  }
  if (payload.success === false) {
    throw new Error("Resposta inesperada da API de SMS.");
  }
  return (payload.data ?? payload) as T;
}

export async function testSms(config: SmsConfig): Promise<ConnectionResult> {
  try {
    const flavor = smsFlavor(config.baseUrl);
    if (flavor === "com") {
      const me = await nvRequest<{ balance?: number; balanceFormatted?: string }>(config, "/balance");
      const saldo = me.balanceFormatted ?? (typeof me.balance === "number" ? `R$ ${me.balance}` : "");
      return { ok: true, mensagem: `SMS autenticado (Bearer). Saldo: ${saldo || "ok"}.` };
    }
    const me = await nvRequest<{ email?: string; balance?: number }>(config, "/me");
    const saldo = typeof me.balance === "number" ? ` Saldo: R$ ${me.balance.toFixed(2)}.` : "";
    return { ok: true, mensagem: `SMS autenticado.${saldo}` };
  } catch (error) {
    logError("sms", error, "teste de conexão");
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha ao falar com o SMS." };
  }
}

export async function listSmsServices(config: SmsConfig): Promise<SmsService[]> {
  const flavor = smsFlavor(config.baseUrl);
  const country = normalizeSmsCountry(config.countryCode, flavor);
  if (flavor === "com") {
    const data = await nvRequest<{ services?: Array<Record<string, unknown>> }>(config, `/services?country=${encodeURIComponent(country)}`);
    return mapSmsServices(data);
  }
  const data = await nvRequest<Array<{ code?: string; name?: string }>>(config, `/sms/services?country=${encodeURIComponent(country)}`);
  return mapSmsServices(
    (Array.isArray(data) ? data : []).map((item) => ({
      id: "",
      code: item.code ?? "",
      name: item.name ?? item.code ?? "",
      options: [],
    })),
  );
}

export function mapActivation(raw: Record<string, unknown>): SmsActivation {
  const item = unwrapActivationPayload(raw);
  const smsText = item.smsText ? String(item.smsText) : "";
  const smsCode = item.smsCode ? String(item.smsCode) : undefined;
  const nested = Array.isArray(item.messages)
    ? item.messages.map((row) => {
        const message = row as Record<string, unknown>;
        return {
          id: String(message.id ?? ""),
          text: String(message.text ?? ""),
          code: message.code ? String(message.code) : undefined,
          receivedAt: String(message.receivedAt ?? item.createdAt ?? ""),
        };
      })
    : [];
  const id = firstString(item, ["id", "activationId", "activation_id", "_id"]);
  const phone = firstString(item, ["phone", "phoneNumber", "number", "msisdn", "fullPhone", "line"]);
  const apiId = firstString(item, ["apiId", "api_id"]);
  const serviceName = firstString(item, ["serviceName", "service_name", "service"]);
  const createdAt = firstString(item, ["createdAt", "created_at", "created"]) || undefined;
  const expiresAt = firstString(item, ["expiresAt", "expires_at", "expireAt", "expires"]) || undefined;
  const optionLabel = firstString(item, ["optionLabel", "option"]) || apiId;
  const messages =
    nested.length > 0
      ? nested
      : smsText || smsCode
        ? [{ id: id || "sms", text: smsText || smsCode || "", code: smsCode, receivedAt: createdAt ?? "" }]
        : [];
  return {
    id,
    phone,
    status: firstString(item, ["status"]),
    ddd: item.ddd ? normalizeDdd(String(item.ddd)) || undefined : dddFromPhone(phone),
    expiresAt,
    createdAt,
    serviceName: serviceName || undefined,
    optionLabel: optionLabel || undefined,
    apiId: apiId || undefined,
    messages,
  };
}

export function persistActivationSnapshot(config: SmsConfig, live: SmsActivation[]): Pick<SmsConfig, "knownActivations" | "activationChanges"> {
  const list = mergeSeenActivations(live, config.knownActivations);
  const incoming = diffActivationChanges(config.knownActivations, list);
  return {
    knownActivations: list,
    activationChanges: [...incoming, ...(config.activationChanges ?? [])].slice(0, 200),
  };
}

function resolveServiceId(config: SmsConfig): number | undefined {
  const raw = config.serviceId?.trim();
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  return undefined;
}

export async function createSmsNumber(config: SmsConfig): Promise<SmsActivation> {
  const flavor = smsFlavor(config.baseUrl);
  if (flavor === "com") {
    let serviceId = resolveServiceId(config);
    let option: SmsServiceOption | undefined;
    const services = await listSmsServices(config).catch(() => [] as SmsService[]);
    if (!serviceId) {
      const wanted = (config.serviceCode.trim() || "fb").toLowerCase();
      const found = services.find((item) => item.code.toLowerCase() === wanted) ?? services.find((item) => /facebook/i.test(item.name));
      serviceId = found?.id && /^\d+$/.test(found.id) ? Number(found.id) : 60033;
    }
    option = resolveSmsSelection(services, { ...config, serviceId: String(serviceId) }).option;
    const data = await nvRequest<Record<string, unknown>>(config, "/activations", {
      method: "POST",
      body: JSON.stringify(buildCreateBody({ ...config, serviceId: String(serviceId), apiId: option?.apiId || config.apiId }, option)),
    });
    log("info", "sms", `ativação keys=${Object.keys(unwrapActivationPayload(data)).join(",")}`);
    return mapActivation(data);
  }
  const data = await nvRequest<{ activations?: Array<Record<string, unknown>> }>(config, "/sms/activations", {
    method: "POST",
    body: JSON.stringify({
      countryCode: normalizeSmsCountry(config.countryCode, "app"),
      serviceCode: config.serviceCode.trim() || "ot",
      quantity: 1,
    }),
  });
  const first = data.activations?.[0];
  if (!first) throw new Error("A API não devolveu número. Confira saldo e estoque.");
  return mapActivation(first);
}

export async function readSmsActivation(config: SmsConfig, activationId: string): Promise<SmsActivation> {
  const flavor = smsFlavor(config.baseUrl);
  const path = flavor === "com" ? `/activations/${encodeURIComponent(activationId)}` : `/sms/activations/${encodeURIComponent(activationId)}`;
  const data = await nvRequest<Record<string, unknown>>(config, path);
  return mapActivation(data);
}

export async function cancelSmsActivation(config: SmsConfig, activationId: string): Promise<{ message: string; status: string; refunded?: boolean }> {
  const flavor = smsFlavor(config.baseUrl);
  const path = flavor === "com" ? `/activations/${encodeURIComponent(activationId)}` : `/sms/activations/${encodeURIComponent(activationId)}`;
  const data = await nvRequest<{ message?: string; status?: string; refunded?: boolean }>(config, path, { method: "DELETE" });
  return {
    message: data.message ?? "Ativação cancelada.",
    status: data.status ?? "cancelled",
    refunded: data.refunded,
  };
}

export async function refreshKnownActivations(config: SmsConfig): Promise<SmsActivation[]> {
  const ids = [...new Set((config.knownActivations ?? []).map((item) => item.id).filter(Boolean))];
  if (config.lastActivationId && !ids.includes(config.lastActivationId)) ids.unshift(config.lastActivationId);
  if (ids.length === 0) return [];
  const refreshed: SmsActivation[] = [];
  for (const id of ids) {
    try {
      refreshed.push(await readSmsActivation(config, id));
    } catch (error) {
      log("warn", "sms", `não atualizou ativação ${id}: ${error instanceof Error ? error.message : "erro"}`);
      const cached = (config.knownActivations ?? []).find((item) => item.id === id);
      if (cached) refreshed.push(cached);
    }
  }
  return refreshed;
}

export async function listSmsActivations(config: SmsConfig): Promise<SmsActivation[]> {
  const flavor = smsFlavor(config.baseUrl);
  const path = flavor === "com" ? "/activations" : "/sms/activations";
  try {
    const data = await nvRequest<unknown>(config, path);
    const list = extractActivationList(data).map(mapActivation).filter((item) => item.id);
    log("info", "sms", `GET ${path} → ${list.length} ativação(ões)`);
    return list;
  } catch (error) {
    log("warn", "sms", `GET ${path} falhou: ${error instanceof Error ? error.message : "erro"}`);
    return refreshKnownActivations(config);
  }
}
