import type { MailInbox, MailMessage } from "./types";

export function rememberInbox(list: MailInbox[] | undefined, item: MailInbox): MailInbox[] {
  if (!item.address) return list ?? [];
  const next = [item, ...(list ?? []).filter((row) => row.address !== item.address && row.id !== item.id)];
  return next.slice(0, 50);
}

export function mergeSeenMessages(live: MailMessage[], cached: MailMessage[] | undefined): MailMessage[] {
  const byId = new Map<string, MailMessage>();
  for (const item of cached ?? []) {
    if (item.id) byId.set(item.id, item);
  }
  for (const item of live) {
    if (!item.id) continue;
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? { ...previous, ...item } : item);
  }
  return [...byId.values()].sort((a, b) => (b.receivedAt ?? b.seenAt ?? "").localeCompare(a.receivedAt ?? a.seenAt ?? "") || b.id.localeCompare(a.id));
}

export function inboxStatusLabel(active: boolean): string {
  return active ? "ATIVO" : "SEM ACESSO";
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
