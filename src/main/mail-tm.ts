import { inboxStatusLabel, mapMailMessage, mergeSeenMessages, rememberInbox } from "@shared/mail-view";
import type { ConnectionResult, EmailConfig, MailInbox, MailMessage } from "@shared/types";
import { log, logError } from "./log";

export { inboxStatusLabel, mapMailMessage, mergeSeenMessages, rememberInbox };

interface DoEnvelope<T> {
  code?: number;
  status?: boolean;
  msg?: string;
  data?: T;
}

export function normalizeEmailBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (!trimmed || /22\.do/i.test(trimmed)) return "https://22.do/api/v2";
  return trimmed;
}

export function emailReady(config: EmailConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim());
}

async function doRequest<T>(config: EmailConfig, path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  if (init?.auth !== false && !emailReady(config)) {
    throw new Error("E-mail só é usado quando URL e token da 22.do estão configurados.");
  }
  const url = new URL(path.replace(/^\//, ""), `${normalizeEmailBase(config.baseUrl)}/`);
  log("info", "email", `${init?.method ?? "GET"} ${url.pathname}`);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.auth !== false && config.bearer) headers.Authorization = `Bearer ${config.bearer}`;
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  let payload: DoEnvelope<T>;
  try {
    payload = JSON.parse(text) as DoEnvelope<T>;
  } catch {
    log("error", "email", `resposta inválida HTTP ${response.status} em ${url.pathname}`);
    throw new Error(`22.do HTTP ${response.status}: resposta inválida.`);
  }
  if (payload.status === false || (payload.code != null && payload.code >= 400)) {
    const message = payload.msg || `22.do HTTP ${payload.code ?? response.status}.`;
    log("error", "email", `${url.pathname} → ${message}`);
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(`22.do HTTP ${response.status}.`);
  }
  return (payload.data ?? payload) as T;
}

export async function ensureBearer(config: EmailConfig): Promise<EmailConfig> {
  if (config.bearer && config.bearerExpires * 1000 > Date.now() + 30_000) return config;
  const data = await doRequest<{ Bearer?: string; expireTime?: number }>(config, "/token", {
    method: "POST",
    body: JSON.stringify({ token: config.apiKey.trim() }),
    auth: false,
  });
  if (!data.Bearer) throw new Error("22.do não devolveu Bearer. Confira o token em 22.do/document.");
  config.bearer = data.Bearer;
  config.bearerExpires = Number(data.expireTime) || 0;
  return config;
}

export async function createInbox(config: EmailConfig): Promise<MailInbox> {
  await ensureBearer(config);
  const data = await doRequest<{ email?: string; account?: string; domain?: string; type?: string }>(config, "/account", {
    method: "POST",
  });
  const address = String(data.email ?? "").trim();
  if (!address) throw new Error("22.do não devolveu endereço.");
  return {
    id: address,
    address,
    token: "",
    password: "",
    createdAt: new Date().toISOString(),
    active: true,
    lastCheckedAt: new Date().toISOString(),
    messages: [],
  };
}

export async function listMessages(config: EmailConfig, address: string): Promise<MailMessage[]> {
  await ensureBearer(config);
  const data = await doRequest<Array<Record<string, unknown>>>(config, "/inbox", {
    method: "POST",
    body: JSON.stringify({ email: address }),
  });
  return (Array.isArray(data) ? data : []).map((item) => {
    const mapped = mapMailMessage(item);
    const blob = `${mapped.subject} ${mapped.intro}`;
    return {
      ...mapped,
      code: extractValidationCode(blob),
      link: extractConfirmationLink(blob),
    };
  });
}

export async function readMessage(config: EmailConfig, messageId: string): Promise<MailMessage> {
  await ensureBearer(config);
  const item = await doRequest<Record<string, unknown>>(config, "/inbox/message", {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
  const mapped = mapMailMessage(item);
  const blob = `${mapped.subject} ${mapped.intro} ${String(item.body ?? "")} ${String(item.html ?? "")}`;
  return {
    ...mapped,
    intro: mapped.intro || String(item.body ?? ""),
    code: extractValidationCode(blob),
    link: extractConfirmationLink(blob),
  };
}

export async function probeInbox(config: EmailConfig, inbox: MailInbox): Promise<MailInbox> {
  const now = new Date().toISOString();
  try {
    const live = await listMessages(config, inbox.address);
    return {
      ...inbox,
      active: true,
      lastCheckedAt: now,
      messages: mergeSeenMessages(live, inbox.messages),
    };
  } catch (error) {
    log("warn", "email", `caixa ${inbox.address} sem acesso: ${error instanceof Error ? error.message : "erro"}`);
    return { ...inbox, active: false, lastCheckedAt: now };
  }
}

export async function refreshInboxMessages(config: EmailConfig, inbox: MailInbox): Promise<MailInbox> {
  const listed = await listMessages(config, inbox.address);
  const detailed = await Promise.all(listed.map((item) => readMessage(config, item.id).catch(() => item)));
  return {
    ...inbox,
    active: true,
    lastCheckedAt: new Date().toISOString(),
    messages: mergeSeenMessages(detailed, inbox.messages),
  };
}

export function extractValidationCode(text: string): string | undefined {
  const match = text.match(/\b(\d{4,8})\b/);
  return match?.[1];
}

export function extractConfirmationLink(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match?.[0];
}

export async function testEmail(config: EmailConfig): Promise<ConnectionResult> {
  try {
    if (!emailReady(config)) {
      return { ok: false, mensagem: "E-mail só é usado quando URL e token da 22.do estão configurados." };
    }
    await ensureBearer(config);
    const domains = await doRequest<Array<{ domain?: string }>>(config, "/domains");
    const first = Array.isArray(domains) ? domains[0]?.domain : "";
    return { ok: true, mensagem: first ? `22.do ok. Domínio: ${first}.` : "22.do autenticado." };
  } catch (error) {
    logError("email", error, "teste 22.do");
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha na 22.do." };
  }
}
