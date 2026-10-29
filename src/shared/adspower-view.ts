import { formatActivationWhen } from "./sms-view";
import type { AdsPowerProfile } from "./types";

function text(value: unknown): string | undefined {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function unixToIso(value: unknown): string | undefined {
  if (value === 0 || value === "0") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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

export function mapAdsPowerProfile(raw: Record<string, unknown> | undefined): AdsPowerProfile | undefined {
  const userId = text(raw?.user_id);
  if (!userId) return undefined;
  return {
    userId,
    serial: text(raw?.serial_number),
    name: text(raw?.name),
    groupName: text(raw?.group_name),
    username: text(raw?.username),
    domain: text(raw?.domain_name),
    remark: text(raw?.remark),
    ip: text(raw?.ip),
    ipCountry: text(raw?.ip_country),
    createdAt: unixToIso(raw?.created_time),
    lastOpenAt: unixToIso(raw?.last_open_time),
  };
}

export function formatAdsPowerProxy(ip?: string, country?: string): string {
  const host = ip?.trim();
  const cc = country?.trim().toUpperCase();
  if (host && cc) return `${host} · ${cc}`;
  return host || cc || "—";
}

export function formatAdsPowerOpen(iso?: string): string {
  return iso ? formatActivationWhen(iso) : "nunca";
}

export function formatAdsPowerCell(value?: string): string {
  return value?.trim() || "—";
}

export function formatAdsPowerStatus(status?: string): string {
  if (/aberto|active/i.test(status ?? "")) return "ABERTO";
  if (/fechado|inactive/i.test(status ?? "")) return "FECHADO";
  return status ? status.toUpperCase() : "—";
}

export function isPaidAdsPowerListError(message: string): boolean {
  return /paid|subscription|plano/i.test(message);
}

export function isMetaPageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith("facebook.com") || host.endsWith("meta.com");
  } catch {
    return false;
  }
}

export function pickAdsPowerTabIndex(urls: string[], openUrl?: string): number {
  if (openUrl && !isMetaPageUrl(openUrl)) return -1;
  const meta = urls.findIndex((url) => isMetaPageUrl(url));
  if (meta >= 0) return meta;
  return urls.length ? 0 : -1;
}

export function shouldReuseAdsPowerTab(input: { running: boolean; profile?: string | null; target: string }): boolean {
  const target = input.target.trim();
  return Boolean(input.running && input.profile && target && input.profile === target);
}

export function mapAdsPowerActive(serial: string, raw: Record<string, unknown> | undefined): AdsPowerProfile {
  const open = String(raw?.status ?? "").toLowerCase() === "active";
  return {
    userId: serial,
    serial,
    name: `Perfil ${serial}`,
    status: open ? "aberto" : "fechado",
  };
}
