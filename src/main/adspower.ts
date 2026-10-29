import { platformId } from "@harness/compat";
import { isPaidAdsPowerListError, mapAdsPowerActive, mapAdsPowerProfile } from "@shared/adspower-view";
import type { AdsPowerConfig, AdsPowerProfile, ConnectionResult } from "@shared/types";
import { log, logError } from "./log";

const SERIAL_SCAN_LIMIT = 20;
const SERIAL_MISS_LIMIT = 3;
const REQUEST_GAP_MS = process.env.VITEST ? 0 : 1100;
const PROFILE_CACHE_MS = process.env.VITEST ? 60_000 : 8000;

let paidListBlocked = false;
let knownSerials: string[] = [];
let requestGate = Promise.resolve();
let lastRequestAt = 0;
let inflightList: Promise<AdsPowerProfile[]> | null = null;
let cachedProfiles: { at: number; list: AdsPowerProfile[] } | null = null;

export function resetAdsPowerProfileCache(): void {
  paidListBlocked = false;
  knownSerials = [];
  inflightList = null;
  cachedProfiles = null;
  lastRequestAt = 0;
  requestGate = Promise.resolve();
}

export function isAdsPowerRateLimit(message: string): boolean {
  return /too many request/i.test(message);
}

export function isAdsPowerMissingProfile(message: string): boolean {
  return /does not exist|failed/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rememberProfiles(list: AdsPowerProfile[]): AdsPowerProfile[] {
  cachedProfiles = { at: Date.now(), list };
  return list;
}

function cachedIfFresh(): AdsPowerProfile[] | undefined {
  if (!cachedProfiles) return undefined;
  if (Date.now() - cachedProfiles.at > PROFILE_CACHE_MS) return undefined;
  return cachedProfiles.list;
}

export const ADSPOWER_PROBE_URL = "https://github.com/DGMidias/bm-farm-electron";

export function profileParams(profileId: string): Record<string, string> {
  if (!/^[A-Za-z0-9]+$/.test(profileId)) {
    throw new Error("Perfil AdsPower deve ser alfanumérico.");
  }
  return /^\d+$/.test(profileId) ? { serial_number: profileId } : { user_id: profileId };
}

export async function adspowerRequest(
  config: AdsPowerConfig,
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  const url = new URL(path, config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const run = requestGate.then(async () => {
    const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    const response = await fetch(url);
    const payload = (await response.json()) as { code?: number; msg?: string; data?: unknown };
    if (payload.code !== 0) {
      const msg = payload.msg || "erro AdsPower";
      if (/api-key/i.test(msg)) {
        throw new Error("AdsPower ainda pede API key. Desative a autenticação da API local no AdsPower e tente de novo.");
      }
      if (/disorderedid/i.test(msg)) {
        throw new Error("ID do perfil inválido. Use serial_number (2) ou user_id.");
      }
      if (isAdsPowerRateLimit(msg)) {
        log("warn", "adspower", `${path} → ${msg}`);
        throw new Error(msg);
      }
      if (!isPaidAdsPowerListError(msg) && !(path.includes("/browser/active") && isAdsPowerMissingProfile(msg))) {
        log("error", "adspower", `${path} → ${msg}`);
      }
      throw new Error(msg);
    }
    return payload.data ?? {};
  });
  requestGate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function testAdsPower(config: AdsPowerConfig): Promise<ConnectionResult> {
  try {
    await adspowerRequest(config, "/status");
    return { ok: true, mensagem: `AdsPower local ok em ${config.baseUrl} (${platformId()}).` };
  } catch (error) {
    logError("adspower", error, "teste API local");
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha no AdsPower." };
  }
}

function numericHints(hints: string[]): string[] {
  return [...new Set(hints.map((item) => item.trim()).filter((item) => /^\d+$/.test(item)))];
}

async function fetchAdsPowerProfiles(config: AdsPowerConfig, hints: string[]): Promise<AdsPowerProfile[]> {
  if (!paidListBlocked) {
    try {
      const data = (await adspowerRequest(config, "/api/v1/user/list", { page: 1, page_size: 100 })) as {
        list?: Array<Record<string, unknown>>;
      };
      const list = (data.list ?? []).map((item) => mapAdsPowerProfile(item)).filter((item): item is AdsPowerProfile => Boolean(item));
      knownSerials = list.map((item) => item.serial).filter((item): item is string => Boolean(item));
      return rememberProfiles(list);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (isPaidAdsPowerListError(message)) {
        paidListBlocked = true;
        log("warn", "adspower", "GET /user/list é plano pago. Descobrindo perfis pelo serial local.");
      } else if (cachedProfiles?.list) {
        if (isAdsPowerRateLimit(message)) log("warn", "adspower", "API pediu calma; usando a última lista.");
        return cachedProfiles.list;
      } else {
        throw error;
      }
    }
  }
  try {
    return rememberProfiles(await listProfilesBySerial(config, hints));
  } catch (error) {
    if (cachedProfiles?.list) return cachedProfiles.list;
    throw error;
  }
}

export async function listAdsPowerProfiles(config: AdsPowerConfig, hints: string[] = []): Promise<AdsPowerProfile[]> {
  const fresh = cachedIfFresh();
  if (fresh) return fresh;
  if (inflightList) return inflightList;
  inflightList = fetchAdsPowerProfiles(config, hints).finally(() => {
    inflightList = null;
  });
  return inflightList;
}

async function listProfilesBySerial(config: AdsPowerConfig, hints: string[]): Promise<AdsPowerProfile[]> {
  if (knownSerials.length) {
    const refreshed: AdsPowerProfile[] = [];
    for (const serial of knownSerials) {
      const profile = await readSerialProfile(config, serial);
      if (profile) refreshed.push(profile);
    }
    return refreshed;
  }
  const found: AdsPowerProfile[] = [];
  const seen = new Set<string>();
  let misses = 0;
  for (let serial = 1; serial <= SERIAL_SCAN_LIMIT; serial++) {
    const id = String(serial);
    const profile = await readSerialProfile(config, id);
    if (profile) {
      found.push(profile);
      if (profile.serial) seen.add(profile.serial);
      misses = 0;
      continue;
    }
    if (found.length === 0) continue;
    misses += 1;
    if (misses >= SERIAL_MISS_LIMIT) break;
  }
  for (const hint of numericHints(hints)) {
    if (seen.has(hint)) continue;
    const profile = await readSerialProfile(config, hint);
    if (profile) {
      found.push(profile);
      if (profile.serial) seen.add(profile.serial);
    }
  }
  knownSerials = found.map((item) => item.serial).filter((item): item is string => Boolean(item));
  return found;
}

async function readSerialProfile(config: AdsPowerConfig, serial: string): Promise<AdsPowerProfile | undefined> {
  try {
    const data = (await adspowerRequest(config, "/api/v1/browser/active", { serial_number: serial })) as Record<string, unknown>;
    return mapAdsPowerActive(serial, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isPaidAdsPowerListError(message) || isAdsPowerRateLimit(message)) throw error;
    return undefined;
  }
}

export async function isProfileActive(config: AdsPowerConfig, profileId: string): Promise<boolean> {
  try {
    const data = (await adspowerRequest(config, "/api/v1/browser/active", profileParams(profileId))) as Record<string, unknown>;
    return String(data.status ?? "").toLowerCase() === "active";
  } catch {
    return false;
  }
}

export async function startProfile(config: AdsPowerConfig, profileId: string): Promise<string> {
  const data = (await adspowerRequest(config, "/api/v1/browser/start", profileParams(profileId))) as {
    ws?: { puppeteer?: string };
  };
  const ws = data.ws?.puppeteer;
  if (!ws) throw new Error("AdsPower não retornou o endpoint WebSocket.");
  return ws;
}

export async function stopProfile(config: AdsPowerConfig, profileId: string): Promise<void> {
  await adspowerRequest(config, "/api/v1/browser/stop", profileParams(profileId));
}
