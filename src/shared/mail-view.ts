import type { MailInbox, MailKind, MailMessage } from "./types";

export function mailKindFromAddress(address: string): MailKind {
  const host = address.split("@")[1]?.trim().toLowerCase() ?? "";
  if (host === "gmail.com" || host === "googlemail.com") return "gmail";
  if (host === "hotmail.com") return "hotmail";
  if (host === "outlook.com" || host === "live.com") return "outlook";
  return "premium";
}

export function mailKindLabel(kind: MailKind): string {
  if (kind === "gmail") return "Gmail";
  if (kind === "outlook") return "Outlook";
  if (kind === "hotmail") return "Hotmail";
  return "domínio 22.do";
}

export function rememberInbox(list: MailInbox[] | undefined, item: MailInbox): MailInbox[] {
  if (!item.address) return list ?? [];
  const next = [item, ...(list ?? []).filter((row) => row.address !== item.address && row.id !== item.id)];
  return next.slice(0, 50);
}

export function forgetInbox(list: MailInbox[] | undefined, address: string): MailInbox[] {
  const wanted = address.trim().toLowerCase();
  if (!wanted) return list ?? [];
  return (list ?? []).filter(
    (row) => row.address.trim().toLowerCase() !== wanted && row.id?.trim().toLowerCase() !== wanted,
  );
}

function messageKey(item: MailMessage): string {
  if (item.id.trim()) return item.id;
  return [item.receivedAt, item.from, item.subject].filter(Boolean).join("|") || "msg";
}

export function mergeSeenMessages(live: MailMessage[], cached: MailMessage[] | undefined): MailMessage[] {
  const byId = new Map<string, MailMessage>();
  for (const item of cached ?? []) {
    const key = messageKey(item);
    byId.set(key, item.id.trim() ? item : { ...item, id: key });
  }
  for (const item of live) {
    const key = messageKey(item);
    const normalized = item.id.trim() ? item : { ...item, id: key };
    const previous = byId.get(key);
    byId.set(key, previous ? { ...previous, ...normalized } : normalized);
  }
  return [...byId.values()].sort((a, b) => (b.receivedAt ?? b.seenAt ?? "").localeCompare(a.receivedAt ?? a.seenAt ?? "") || b.id.localeCompare(a.id));
}

export function mergeKnownInboxes(disk: MailInbox[] | undefined, incoming: MailInbox[] | undefined): MailInbox[] {
  const byAddress = new Map<string, MailInbox>();
  for (const item of [...(disk ?? []), ...(incoming ?? [])]) {
    if (!item.address) continue;
    const previous = byAddress.get(item.address);
    if (!previous) {
      byAddress.set(item.address, item);
      continue;
    }
    byAddress.set(item.address, {
      ...previous,
      ...item,
      messages: mergeSeenMessages(item.messages ?? [], previous.messages),
      empresaId: item.empresaId || previous.empresaId,
      razaoSocial: item.razaoSocial || previous.razaoSocial,
      adspowerProfile: item.adspowerProfile || previous.adspowerProfile,
    });
  }
  return [...byAddress.values()].slice(0, 50);
}

export function inboxStatusLabel(active: boolean): string {
  return active ? "ATIVO" : "SEM ACESSO";
}

export function inboxOwnerLabel(inbox: Pick<MailInbox, "razaoSocial" | "adspowerProfile">): string {
  const empresa = inbox.razaoSocial?.trim() || "sem empresa";
  const profile = inbox.adspowerProfile?.trim();
  return profile ? `${empresa} · perfil ${profile}` : empresa;
}

export function findCompanyInbox(
  list: MailInbox[] | undefined,
  card: { id?: string; email_comercial?: string; razao_social?: string; adspower_profile?: string },
): MailInbox | undefined {
  const inboxes = list ?? [];
  const byId = card.id ? inboxes.find((item) => item.empresaId === card.id) : undefined;
  if (byId) return byId;
  const address = card.email_comercial?.trim().toLowerCase();
  if (address) {
    const byAddress = inboxes.find((item) => item.address.trim().toLowerCase() === address);
    if (byAddress) return byAddress;
  }
  const razao = card.razao_social?.trim();
  const profile = card.adspower_profile?.trim();
  if (razao && profile) {
    return inboxes.find((item) => item.razaoSocial === razao && item.adspowerProfile === profile);
  }
  return undefined;
}

export function isMailAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    return (
      /\.(png|jpe?g|gif|svg|webp|css|ico)(\?|$)/i.test(path) ||
      /\/images\//i.test(path) ||
      /email_open_log_pic/i.test(path)
    );
  } catch {
    return true;
  }
}

export function isMailConfirmLink(url: string): boolean {
  if (isMailAssetUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)meta\.com$/.test(host)) return false;
    return /verify\/email|email\/checkpoint|confirmemail|confirm[_-]?email|email\/confirm|\/confirm(?:\.php)?\b/i.test(
      `${parsed.pathname}${parsed.search}`,
    );
  } catch {
    return false;
  }
}

export function confirmationLinkFromInbox(inbox: Pick<MailInbox, "messages">): string | undefined {
  for (const item of inbox.messages) {
    if (item.link && isMailConfirmLink(item.link)) return item.link;
  }
  return undefined;
}

export function emailConfirmPendingOnSettings(texts: string[]): boolean {
  return texts.some((line) => /confirmação pendente|pending confirmation|confirmation pending/i.test(line));
}

export function emailConfirmEtapaConcluida(input: { url: string; texts: string[] }): boolean {
  if (!/\/latest\/settings\/business_info/i.test(input.url)) return false;
  if (emailConfirmPendingOnSettings(input.texts)) return false;
  return /informações de contato do perfil|profile contact information/i.test(input.texts.join(" "));
}

function unixToIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && /^\d+$/.test(value.trim())) {
      return unixToIso(numeric);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

export function mapMailMessage(raw: Record<string, unknown>, seenAt = new Date().toISOString()): MailMessage {
  const from = raw.from;
  const fromAddress =
    typeof from === "string"
      ? from
      : from && typeof from === "object"
        ? String((from as { address?: unknown }).address ?? "")
        : "";
  return {
    id: String(raw.messageId ?? raw.id ?? ""),
    from: fromAddress,
    subject: String(raw.subject ?? ""),
    intro: String(raw.intro ?? raw.body ?? raw.text ?? ""),
    receivedAt: raw.createdAt ? String(raw.createdAt) : unixToIso(raw.time),
    seenAt,
    code: typeof raw.code === "string" ? raw.code : undefined,
    link: typeof raw.link === "string" ? raw.link : undefined,
  };
}
