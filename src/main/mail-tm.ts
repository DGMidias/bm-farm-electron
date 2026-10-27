import { inboxStatusLabel, mapMailMessage, mergeSeenMessages, rememberInbox } from "@shared/mail-view";
import type { ConnectionResult, EmailConfig, MailInbox, MailMessage } from "@shared/types";
import { log, logError } from "./log";

export { inboxStatusLabel, mapMailMessage, mergeSeenMessages, rememberInbox };

const MAIL_TM = "https://api.mail.tm";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAIL_TM}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    log("error", "email", `${path} HTTP ${response.status}`);
    throw new Error(`mail.tm ${path} falhou (${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function createInbox(config: EmailConfig): Promise<MailInbox> {
  const domains = await json<{ "hydra:member"?: Array<{ domain: string }> }>("/domains");
  const domain = domains["hydra:member"]?.[0]?.domain;
  if (!domain) throw new Error("mail.tm não retornou domínio.");
  const local = `bm${Math.random().toString(36).slice(2, 10)}`;
  const address = `${local}@${domain}`;
  const password = config.password || `Tmp-${Math.random().toString(36).slice(2, 12)}`;
  const account = await json<{ id?: string }>("/accounts", {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });
  const tokenRes = await json<{ token: string }>("/token", {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });
  return {
    id: account.id ? String(account.id) : address,
    address,
    token: tokenRes.token,
    password,
    createdAt: new Date().toISOString(),
    active: true,
    lastCheckedAt: new Date().toISOString(),
    messages: [],
  };
}

export async function listMessages(token: string): Promise<MailMessage[]> {
  const data = await json<{ "hydra:member"?: Array<Record<string, unknown> & { from?: { address?: string } }> }>(
    "/messages",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return (data["hydra:member"] ?? []).map((item) => {
    const mapped = mapMailMessage(item);
    const blob = `${mapped.subject} ${mapped.intro}`;
    return {
      ...mapped,
      from: mapped.from || item.from?.address || "",
      code: extractValidationCode(blob),
      link: extractConfirmationLink(blob),
    };
  });
}

export async function ensureToken(inbox: Pick<MailInbox, "address" | "password" | "token">): Promise<string> {
  if (inbox.token) {
    try {
      await json("/me", { headers: { Authorization: `Bearer ${inbox.token}` } });
      return inbox.token;
    } catch {
      log("warn", "email", `token vencido em ${inbox.address}, renovando`);
    }
  }
  const tokenRes = await json<{ token: string }>("/token", {
    method: "POST",
    body: JSON.stringify({ address: inbox.address, password: inbox.password }),
  });
  if (!tokenRes.token) throw new Error("Sem acesso a esta caixa.");
  return tokenRes.token;
}

export async function probeInbox(inbox: MailInbox): Promise<MailInbox> {
  const now = new Date().toISOString();
  try {
    const token = await ensureToken(inbox);
    const live = await listMessages(token);
    return {
      ...inbox,
      token,
      active: true,
      lastCheckedAt: now,
      messages: mergeSeenMessages(live, inbox.messages),
    };
  } catch (error) {
    log("warn", "email", `caixa ${inbox.address} sem acesso: ${error instanceof Error ? error.message : "erro"}`);
    return { ...inbox, active: false, lastCheckedAt: now };
  }
}

export async function refreshInboxMessages(inbox: MailInbox): Promise<MailInbox> {
  const token = await ensureToken(inbox);
  const listed = await listMessages(token);
  const detailed = await Promise.all(listed.map((item) => readMessage(token, item.id).catch(() => item)));
  return {
    ...inbox,
    token,
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

export async function testEmail(): Promise<ConnectionResult> {
  try {
    const domains = await json<{ "hydra:member"?: Array<{ domain: string }> }>("/domains");
    const domain = domains["hydra:member"]?.[0]?.domain;
    if (!domain) return { ok: false, mensagem: "mail.tm respondeu sem domínio." };
    return { ok: true, mensagem: `mail.tm ok. Domínio disponível: ${domain}.` };
  } catch (error) {
    logError("email", error, "teste mail.tm");
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha no mail.tm." };
  }
}

export async function readMessage(token: string, id: string): Promise<MailMessage> {
  const item = await json<{
    id: string;
    from?: { address?: string };
    subject?: string;
    intro?: string;
    text?: string;
    html?: string;
    createdAt?: string;
  }>(`/messages/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = `${item.subject ?? ""} ${item.intro ?? ""} ${item.text ?? ""} ${item.html ?? ""}`;
  return {
    id: item.id,
    from: item.from?.address ?? "",
    subject: item.subject ?? "",
    intro: item.intro ?? item.text ?? "",
    receivedAt: item.createdAt,
    code: extractValidationCode(blob),
    link: extractConfirmationLink(blob),
  };
}
