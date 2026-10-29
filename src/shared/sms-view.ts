import type { SmsActivation, SmsActivationChange, SmsConfig, SmsMessage, SmsService, SmsServiceOption } from "./types";

const DDD_FLAG_KEYS = ["supportsDdd", "supportDdd", "allowDdd", "allowsDdd", "dddEnabled", "hasDdd", "dddSupported"] as const;

export function latestSms(messages: SmsMessage[]): SmsMessage | undefined {
  return [...messages].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).at(-1);
}

export function sortSmsServices(list: SmsService[]): SmsService[] {
  return [...list].sort((a, b) => {
    const rank = (item: SmsService) => (item.id === "60033" || item.code.toLowerCase() === "fb" || /^facebook$/i.test(item.name) ? 0 : 1);
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "pt");
  });
}

export function formatExpiry(expiresAt?: string, now = Date.now()): string {
  if (!expiresAt) return "sem prazo";
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return expiresAt;
  const ms = end - now;
  if (ms <= 0) return "expirado";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}min`;
  return `${min}min ${sec}s`;
}

export function canCancelActivation(item: SmsActivation, now = Date.now()): boolean {
  if (/cancelled|completed|expired/i.test(item.status)) return false;
  if (!item.expiresAt) return true;
  return new Date(item.expiresAt).getTime() > now;
}

export function optionAllowsDdd(raw: Record<string, unknown> | Pick<SmsServiceOption, "name" | "allowsDdd">): boolean {
  if (typeof (raw as { allowsDdd?: unknown }).allowsDdd === "boolean") return Boolean((raw as { allowsDdd: boolean }).allowsDdd);
  const record = raw as Record<string, unknown>;
  for (const key of DDD_FLAG_KEYS) {
    if (key in record) return Boolean(record[key]);
  }
  if (typeof record.ddd === "boolean") return record.ddd;
  return /op[cç][aã]o\s*(1|4)\b/i.test(String(record.name ?? ""));
}

export function formatSmsOptionLabel(option: SmsServiceOption): string {
  const price = option.priceFormatted || option.price || "";
  const ddd = option.allowsDdd ? " · ◎ DDD" : "";
  return `${option.name}${price ? ` · ${price}` : ""}${ddd}`;
}

export function defaultSmsOption(options: SmsServiceOption[]): SmsServiceOption | undefined {
  return options.find((item) => item.allowsDdd) ?? options[0];
}

export function resolveSmsSelection(
  services: SmsService[],
  config: Pick<SmsConfig, "serviceId" | "serviceCode" | "apiId">,
): { group?: SmsService; option?: SmsServiceOption; allowsDdd: boolean } {
  const wanted = (config.serviceCode || "fb").toLowerCase();
  const group =
    services.find((item) => item.id && item.id === config.serviceId) ??
    services.find((item) => item.code.toLowerCase() === wanted) ??
    services.find((item) => /facebook/i.test(item.name)) ??
    services[0];
  const option = group?.options.find((item) => item.apiId && item.apiId === config.apiId) ?? defaultSmsOption(group?.options ?? []);
  return { group, option, allowsDdd: option?.allowsDdd ?? true };
}

export function mapSmsOption(raw: Record<string, unknown>): SmsServiceOption {
  const apiId = raw.apiId != null && String(raw.apiId) !== "" ? String(raw.apiId) : "";
  const priceFormatted = raw.priceFormatted != null ? String(raw.priceFormatted) : undefined;
  const price = raw.price != null ? String(raw.price) : undefined;
  return {
    apiId,
    name: String(raw.name ?? (apiId ? `Opção ${apiId}` : "Opção")),
    price,
    priceFormatted,
    available: typeof raw.available === "number" ? raw.available : Number(raw.available) || 0,
    allowsDdd: optionAllowsDdd(raw),
  };
}

export function mapSmsServices(payload: { services?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>): SmsService[] {
  const list = Array.isArray(payload) ? payload : (payload.services ?? []);
  return sortSmsServices(
    list
      .map((item) => {
        const options = Array.isArray(item.options) ? item.options.map((row) => mapSmsOption(row as Record<string, unknown>)) : [];
        return {
          id: item.serviceId != null ? String(item.serviceId) : item.id != null ? String(item.id) : "",
          code: String(item.serviceCode ?? item.code ?? ""),
          name: String(item.serviceName ?? item.name ?? item.serviceCode ?? ""),
          price: item.priceFormatted != null ? String(item.priceFormatted) : undefined,
          options,
        };
      })
      .filter((item) => item.id || item.code),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function unwrapActivationPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = raw.activation ?? raw.data;
  if (isRecord(nested)) return { ...raw, ...nested };
  const list = raw.activations ?? raw.items ?? raw.entries;
  if (Array.isArray(list) && isRecord(list[0])) return { ...raw, ...list[0] };
  return raw;
}

export function extractActivationList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const list = payload.activations ?? payload.items ?? payload.entries ?? payload.data;
  if (Array.isArray(list)) return list.filter(isRecord);
  if (isRecord(list)) {
    const nested = list.activations ?? list.items ?? list.entries;
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  if (payload.id || payload.phone || payload.phoneNumber || payload.activationId || payload.number) return [payload];
  return [];
}

export function mergeSeenActivations(live: SmsActivation[], cached: SmsActivation[] | undefined): SmsActivation[] {
  const byId = new Map<string, SmsActivation>();
  for (const item of cached ?? []) {
    if (item.id) byId.set(item.id, item);
  }
  for (const item of live) {
    if (!item.id) continue;
    const previous = byId.get(item.id);
    byId.set(
      item.id,
      previous
        ? {
            ...previous,
            ...item,
            messages: item.messages.length > 0 ? item.messages : previous.messages,
            empresaId: item.empresaId || previous.empresaId,
            razaoSocial: item.razaoSocial || previous.razaoSocial,
            adspowerProfile: item.adspowerProfile || previous.adspowerProfile,
          }
        : item,
    );
  }
  return [...byId.values()]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id))
    .slice(0, 100);
}

function smsFingerprint(item: SmsActivation): string {
  const last = latestSms(item.messages);
  return last?.code || last?.text || "";
}

export function diffActivationChanges(
  previous: SmsActivation[] | undefined,
  next: SmsActivation[],
  now = new Date().toISOString(),
): SmsActivationChange[] {
  const old = new Map((previous ?? []).filter((item) => item.id).map((item) => [item.id, item]));
  const changes: SmsActivationChange[] = [];
  for (const item of next) {
    if (!item.id) continue;
    const before = old.get(item.id);
    if (!before) {
      changes.push({
        id: `${item.id}:seen:${now}`,
        activationId: item.id,
        timestamp: now,
        field: "seen",
        from: "",
        to: item.phone || item.status,
      });
      continue;
    }
    const pairs: Array<[string, string, string]> = [
      ["status", before.status, item.status],
      ["phone", before.phone, item.phone],
      ["expiresAt", before.expiresAt ?? "", item.expiresAt ?? ""],
      ["sms", smsFingerprint(before), smsFingerprint(item)],
    ];
    for (const [field, from, to] of pairs) {
      if (from === to) continue;
      changes.push({
        id: `${item.id}:${field}:${now}`,
        activationId: item.id,
        timestamp: now,
        field,
        from,
        to,
      });
    }
  }
  return changes;
}

export function formatRestClock(expiresAt?: string, now = Date.now()): string {
  if (!expiresAt) return "--:--";
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return "--:--";
  const ms = Math.max(0, end - now);
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatActivationWhen(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hour}:${minute}`;
}

export function activationStatusLabel(status: string): string {
  if (/waiting|pending|active|ativo/i.test(status)) return "ATIVO";
  if (/cancel/i.test(status)) return "CANCELADO";
  if (/expir/i.test(status)) return "EXPIRADO";
  if (/receiv|finish|complete|done/i.test(status)) return "CONCLUÍDO";
  return status ? status.toUpperCase() : "—";
}

export function nationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) return digits.slice(2);
  return digits || phone;
}

export function activationOwnerLabel(item: Pick<SmsActivation, "razaoSocial" | "adspowerProfile">): string {
  const empresa = item.razaoSocial?.trim() || "sem empresa";
  const profile = item.adspowerProfile?.trim();
  return profile ? `${empresa} · perfil ${profile}` : empresa;
}
