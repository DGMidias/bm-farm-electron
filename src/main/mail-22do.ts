import {
  forgetInbox,
  inboxStatusLabel,
  isMailConfirmLink,
  mailKindFromAddress,
  mailKindLabel,
  mapMailMessage,
  mergeKnownInboxes,
  mergeSeenMessages,
  rememberInbox,
} from "@shared/mail-view";
import type { ConnectionResult, EmailConfig, MailInbox, MailKind, MailMessage } from "@shared/types";
import { log, logError } from "./log";

export { forgetInbox, inboxStatusLabel, mailKindFromAddress, mailKindLabel, mapMailMessage, mergeKnownInboxes, mergeSeenMessages, rememberInbox };

export type RealMailKind = Exclude<MailKind, "premium">;

export const REAL_MAIL_KINDS: readonly RealMailKind[] = ["gmail", "outlook", "hotmail"];

export const DEFAULT_EMAIL_BASE = "https://22.do/api/v2";

export function normalizeEmailBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (!trimmed || /^https?:\/\/22\.do\/?$/i.test(trimmed) || /^https?:\/\/22\.do\/dash\/?$/i.test(trimmed)) {
    return DEFAULT_EMAIL_BASE;
  }
  return trimmed;
}

export function sanitizeEmailToken(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function emailReady(config: Pick<EmailConfig, "baseUrl" | "token">): boolean {
  return Boolean(config.baseUrl.trim() && sanitizeEmailToken(config.token));
}

export function isLegacyMailInbox(address: string): boolean {
  return /@(mail\.tm|maxxspace\.com)$/i.test(address.trim());
}

export function pickRealMailKind(random: () => number = Math.random): RealMailKind {
  const index = Math.min(REAL_MAIL_KINDS.length - 1, Math.floor(random() * REAL_MAIL_KINDS.length));
  return REAL_MAIL_KINDS[index] ?? "gmail";
}


export function inboxApiForKind(kind: MailKind): { list: string; message: string } {
  if (kind === "gmail") return { list: "/gmail/inbox", message: "/gmail/message" };
  if (kind === "outlook" || kind === "hotmail") return { list: "/microsoft/inbox", message: "/microsoft/message" };
  return { list: "/inbox", message: "/inbox/message" };
}

export function parseMailIdList(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item).trim()).filter(Boolean);
}

export function filterMicrosoftByKind(items: string[], kind: "outlook" | "hotmail"): string[] {
  const pattern = kind === "hotmail" ? /@hotmail\.com$/i : /@(outlook|live)\.com$/i;
  return items.filter((item) => pattern.test(item));
}

export function firstGeneratedAddress(data: unknown, fallbackDomain?: string): string | undefined {
  const items = parseMailIdList(data);
  const listed = items.find((item) => item.includes("@"));
  if (listed) return listed;
  if (data && typeof data === "object" && "email" in data) {
    const email = String((data as { email?: unknown }).email ?? "").trim();
    if (email.includes("@")) return email;
  }
  const local = items[0];
  const domains =
    data && typeof data === "object" && Array.isArray((data as { domains?: unknown }).domains)
      ? (data as { domains: unknown[] }).domains.map((item) => String(item).trim())
      : [];
  const domain = (domains[0] || fallbackDomain || "").replace(/^@+/, "");
  if (local && domain) return `${local}@${domain}`;
  return undefined;
}

export function shouldPurchaseMailStock(count: number): boolean {
  return count <= 0;
}

export function mailKindsToTry(preferred: RealMailKind): RealMailKind[] {
  return [preferred, ...REAL_MAIL_KINDS.filter((kind) => kind !== preferred)];
}

export function isMailOutOfStock(message: string): boolean {
  return /out of stock|sem estoque|no stock|sold out/i.test(message);
}

export const MAIL_STOCK_EXHAUSTED =
  "22.do sem estoque de Gmail, Outlook e Hotmail. Tente de novo ou recarregue na dashboard.";


interface Envelope<T> {
  code?: number;
  status?: boolean;
  msg?: string;
  data?: T;
}

export function parse22DoData<T>(raw: unknown): T {
  if (!raw || typeof raw !== "object") throw new Error("22.do respondeu vazio.");
  const env = raw as Envelope<T>;
  if (env.status === false || (typeof env.code === "number" && (env.code < 200 || env.code > 204))) {
    throw new Error(env.msg || "22.do recusou a chamada.");
  }
  if (env.data === undefined) throw new Error("22.do respondeu sem data.");
  return env.data;
}

function unixToIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return unixToIso(Number(value));
  return undefined;
}

export function inboxRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  for (const key of ["items", "list", "emails", "messages", "hydra:member"]) {
    if (Array.isArray(record[key])) return inboxRecords(record[key]);
  }
  if (record.email || record.messageId || record.message_id || record.subject) return [record];
  return [];
}

export function messageIdFromRaw(raw: Record<string, unknown>): string {
  const direct = raw.messageId ?? raw.message_id ?? raw.mailId ?? raw.id;
  if (direct !== undefined && String(direct).trim()) return String(direct);
  const stamp = raw.time ?? raw.createdAt ?? "";
  const from = typeof raw.from === "string" ? raw.from : "";
  const subject = String(raw.subject ?? "");
  return [stamp, from, subject].filter(Boolean).join("|") || "msg";
}

export function map22DoMessage(raw: Record<string, unknown>): MailMessage {
  const blob = `${raw.subject ?? ""} ${raw.body ?? ""} ${raw.html ?? ""} ${raw.from ?? ""}`;
  return {
    id: messageIdFromRaw(raw),
    from: String(raw.from ?? ""),
    subject: String(raw.subject ?? ""),
    intro: String(raw.body ?? raw.subject ?? ""),
    receivedAt: unixToIso(raw.time) ?? (raw.createdAt ? String(raw.createdAt) : undefined),
    code: extractValidationCode(blob),
    link: extractConfirmationLink(blob),
  };
}

async function request<T>(
  config: EmailConfig,
  path: string,
  init?: RequestInit & { skipAuth?: boolean; retry?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (!init?.skipAuth) {
    headers.Authorization = `Bearer ${config.lastBearer || (await ensureBearer(config))}`;
  }
  const response = await fetch(`${normalizeEmailBase(config.baseUrl)}${path}`, {
    ...init,
    headers,
  });
  const raw = (await response.json().catch(() => undefined)) as unknown;
  if (response.status === 401 && !init?.skipAuth && !init?.retry) {
    log("warn", "email", `${path} Bearer vencido, renovando`);
    config.lastBearer = "";
    config.lastBearerExpire = 0;
    await ensureBearer(config);
    return request<T>(config, path, { ...init, retry: true });
  }
  if (!response.ok) {
    log("error", "email", `${path} HTTP ${response.status}`);
    const msg = raw && typeof raw === "object" && "msg" in raw ? String((raw as Envelope<unknown>).msg) : "";
    throw new Error(msg || `22.do ${path} falhou (${response.status}).`);
  }
  return parse22DoData<T>(raw);
}

export async function ensureBearer(config: EmailConfig): Promise<string> {
  if (!emailReady(config)) throw new Error("22.do sem URL ou token.");
  const now = Math.floor(Date.now() / 1000);
  if (config.lastBearer && config.lastBearerExpire > now + 30) return config.lastBearer;
  const data = await request<{ Bearer?: string; expireTime?: number }>(config, "/token", {
    method: "POST",
    body: JSON.stringify({ token: sanitizeEmailToken(config.token) }),
    skipAuth: true,
  });
  if (!data.Bearer) throw new Error("22.do não devolveu Bearer.");
  config.lastBearer = data.Bearer;
  config.lastBearerExpire = Number(data.expireTime) || now + 3600;
  return config.lastBearer;
}

async function listMailStock(config: EmailConfig, kind: RealMailKind): Promise<string[]> {
  if (kind === "gmail") {
    const data = await request<Record<string, unknown>>(config, "/gmail", {
      method: "POST",
      body: JSON.stringify({ page: 1, limit: 20 }),
    });
    return parseMailIdList(data);
  }
  const data = await request<Record<string, unknown>>(config, "/microsoft", {
    method: "POST",
    body: JSON.stringify({ page: 1, limit: 20 }),
  });
  return filterMicrosoftByKind(parseMailIdList(data), kind);
}

async function purchaseMailStock(config: EmailConfig, kind: RealMailKind): Promise<string[]> {
  if (kind === "gmail") {
    const data = await request<Record<string, unknown>>(config, "/gmail/purchase", {
      method: "POST",
      body: JSON.stringify({ number: 1 }),
    });
    log("info", "email", "comprei 1 GmailId na 22.do");
    return parseMailIdList(data);
  }
  const data = await request<Record<string, unknown>>(config, "/microsoft/purchase", {
    method: "POST",
    body: JSON.stringify({
      number: 1,
      outlook: kind === "outlook",
      hotmail: kind === "hotmail",
    }),
  });
  const bought = parseMailIdList(data);
  log("info", "email", `comprei 1 conta ${mailKindLabel(kind)} na 22.do`);
  return bought;
}

function readyMicrosoftAddress(candidates: string[], kind: "outlook" | "hotmail"): string | undefined {
  return filterMicrosoftByKind(candidates.filter((item) => item.includes("@")), kind)[0];
}

async function generateRealAddress(
  config: EmailConfig,
  kind: RealMailKind,
  fallbacks: string[] = [],
): Promise<string> {
  if (kind === "gmail") {
    try {
      const data = await request<Record<string, unknown>>(config, "/gmail/generate", {
        method: "POST",
        body: JSON.stringify({ number: 1, plus: true }),
      });
      const address = firstGeneratedAddress(data, "gmail.com");
      if (address) return address;
    } catch (error) {
      log("warn", "email", `/gmail/generate falhou: ${error instanceof Error ? error.message : "erro"}`);
    }
    const id = fallbacks[0]?.trim();
    if (id) return id.includes("@") ? id : `${id}@gmail.com`;
    throw new Error("22.do não gerou endereço Gmail.");
  }
  const account = readyMicrosoftAddress(fallbacks, kind);
  try {
    const data = await request<Record<string, unknown>>(config, "/microsoft/generate", {
      method: "POST",
      body: JSON.stringify({ number: 1, plus: false, ...(account ? { account } : {}) }),
    });
    const address = firstGeneratedAddress(data);
    if (address) return address;
  } catch (error) {
    log("warn", "email", `/microsoft/generate falhou: ${error instanceof Error ? error.message : "erro"}`);
  }
  if (account) return account;
  throw new Error(`22.do não gerou endereço ${mailKindLabel(kind)}.`);
}

async function createAddressOfKind(config: EmailConfig, kind: RealMailKind): Promise<string> {
  let stock = await listMailStock(config, kind);
  if (shouldPurchaseMailStock(stock.length)) {
    const bought = await purchaseMailStock(config, kind);
    stock = [...bought, ...stock];
  }
  return (await generateRealAddress(config, kind, stock)).trim();
}

export async function createInbox(
  config: EmailConfig,
  owner?: Pick<MailInbox, "empresaId" | "razaoSocial" | "adspowerProfile">,
): Promise<MailInbox> {
  if (!emailReady(config)) throw new Error("22.do sem URL ou token.");
  const kinds = mailKindsToTry(pickRealMailKind());
  const withStock: RealMailKind[] = [];
  const empty: RealMailKind[] = [];
  for (const kind of kinds) {
    const stock = await listMailStock(config, kind).catch(() => []);
    if (stock.length) withStock.push(kind);
    else empty.push(kind);
  }
  const errors: string[] = [];
  for (const kind of [...withStock, ...empty]) {
    try {
      const address = await createAddressOfKind(config, kind);
      log("info", "email", `caixa ${address} · ${mailKindLabel(kind)}`);
      return {
        id: address,
        address,
        token: "",
        password: "",
        createdAt: new Date().toISOString(),
        active: true,
        lastCheckedAt: new Date().toISOString(),
        empresaId: owner?.empresaId,
        razaoSocial: owner?.razaoSocial,
        adspowerProfile: owner?.adspowerProfile,
        kind,
        messages: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro";
      log("warn", "email", `${mailKindLabel(kind)} indisponível: ${message}`);
      errors.push(message);
    }
  }
  throw new Error(errors.length ? `${MAIL_STOCK_EXHAUSTED} (${errors.join(" · ")})` : MAIL_STOCK_EXHAUSTED);
}

export async function listMessages(config: EmailConfig, address: string): Promise<MailMessage[]> {
  const kind = mailKindFromAddress(address);
  const api = inboxApiForKind(kind);
  const data = await request<Array<Record<string, unknown>> | Record<string, unknown>>(config, api.list, {
    method: "POST",
    body: JSON.stringify({ email: address }),
  });
  const items = inboxRecords(data);
  const keys = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).join(",") : "";
  log("info", "email", `inbox ${address} tipo=${Array.isArray(data) ? "array" : typeof data} n=${items.length}${keys ? ` chaves=${keys}` : ""}`);
  return items.map((item) => map22DoMessage(item));
}

export async function readMessage(config: EmailConfig, id: string, address?: string): Promise<MailMessage> {
  const kind = address ? mailKindFromAddress(address) : "premium";
  const api = inboxApiForKind(kind);
  const item = await request<Record<string, unknown>>(config, api.message, {
    method: "POST",
    body: JSON.stringify({ messageId: id }),
  });
  return map22DoMessage(item);
}

export async function probeInbox(config: EmailConfig, inbox: MailInbox): Promise<MailInbox> {
  const now = new Date().toISOString();
  if (isLegacyMailInbox(inbox.address) || !emailReady(config)) {
    return { ...inbox, active: false, lastCheckedAt: now };
  }
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
  if (isLegacyMailInbox(inbox.address)) throw new Error("Caixa mail.tm antiga. Gere uma nova na 22.do.");
  const listed = await listMessages(config, inbox.address);
  const detailed = await Promise.all(listed.map((item) => readMessage(config, item.id, inbox.address).catch(() => item)));
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

function unwrapMailUrl(raw: string): string {
  const cleaned = raw.replace(/&amp;/gi, "&").replace(/[.,;)\]]+$/g, "");
  try {
    const parsed = new URL(cleaned);
    if (/l\.facebook\.com$/i.test(parsed.hostname) || parsed.pathname === "/l.php") {
      const target = parsed.searchParams.get("u");
      if (target) return unwrapMailUrl(target);
    }
  } catch {
    return cleaned;
  }
  return cleaned;
}

export function extractConfirmationLink(text: string): string | undefined {
  const urls = [...text.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map((item) => unwrapMailUrl(item[0]));
  return urls.find((url) => isMailConfirmLink(url));
}

export function emailConfirmSucceeded(input: { url: string; texts: string[] }): boolean {
  const blob = input.texts.join(" ");
  if (/e-?mail (foi )?confirmad|email (has been )?confirm|thanks for confirming|obrigad\w* por confirm/i.test(blob)) {
    return true;
  }
  return /confirm[_-]?email|email\/confirm|confirmemail/i.test(input.url) && /sucesso|success|confirmad|verified/i.test(blob);
}

export async function testEmail(config: EmailConfig): Promise<ConnectionResult> {
  if (!emailReady(config)) return { ok: false, mensagem: "22.do sem token." };
  try {
    await ensureBearer(config);
    const status = await request<{ used?: number; limit?: number }>(config, "/qps/status");
    const used = status.used;
    const limit = status.limit;
    const quota = typeof used === "number" && typeof limit === "number" ? ` · ${used}/${limit} QPS` : "";
    const [gmail, outlook, hotmail] = await Promise.all([
      listMailStock(config, "gmail").catch(() => []),
      listMailStock(config, "outlook").catch(() => []),
      listMailStock(config, "hotmail").catch(() => []),
    ]);
    const stock = ` · Gmail ${gmail.length} · Outlook ${outlook.length} · Hotmail ${hotmail.length}`;
    return { ok: true, mensagem: `22.do ok${stock}${quota}.` };
  } catch (error) {
    logError("email", error, "teste 22.do");
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha na 22.do." };
  }
}
