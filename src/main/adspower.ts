import { platformId } from "@harness/compat";
import { isPaidAdsPowerListError, mapAdsPowerActive, mapAdsPowerProfile } from "@shared/adspower-view";
import type { AdsPowerConfig, AdsPowerProfile, ConnectionResult } from "@shared/types";
import { log, logError } from "./log";

const SERIAL_SCAN_LIMIT = 20;
const SERIAL_MISS_LIMIT = 3;

let paidListBlocked = false;
let knownSerials: string[] = [];

export function resetAdsPowerProfileCache(): void {
  paidListBlocked = false;
  knownSerials = [];
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
  const headers: Record<string, string> = {};
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetch(url, { headers });
  const payload = (await response.json()) as { code?: number; msg?: string; data?: unknown };
  if (payload.code !== 0) {
    const msg = payload.msg || "erro AdsPower";
    if (/api-key/i.test(msg) && !config.apiKey) {
      throw new Error("AdsPower exige API key.");
    }
    if (/disorderedid/i.test(msg)) {
      throw new Error("ID do perfil inválido. Use serial_number (2) ou user_id.");
    }
    if (!isPaidAdsPowerListError(msg) && !(path.includes("/browser/active") && /failed/i.test(msg))) {
      log("error", "adspower", `${path} → ${msg}`);
    }
    throw new Error(msg);
  }
  return payload.data ?? {};
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

export async function listAdsPowerProfiles(config: AdsPowerConfig): Promise<AdsPowerProfile[]> {
  if (!paidListBlocked) {
    try {
      const data = (await adspowerRequest(config, "/api/v1/user/list", { page: 1, page_size: 100 })) as {
        list?: Array<Record<string, unknown>>;
      };
      const list = (data.list ?? []).map((item) => mapAdsPowerProfile(item)).filter((item): item is AdsPowerProfile => Boolean(item));
      knownSerials = list.map((item) => item.serial).filter((item): item is string => Boolean(item));
      return list;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!isPaidAdsPowerListError(message)) throw error;
      paidListBlocked = true;
      log("warn", "adspower", "GET /user/list é plano pago. Descobrindo perfis pelo serial local.");
    }
  }
  return listProfilesBySerial(config);
}

async function listProfilesBySerial(config: AdsPowerConfig): Promise<AdsPowerProfile[]> {
  if (knownSerials.length) {
    const refreshed: AdsPowerProfile[] = [];
    for (const serial of knownSerials) {
      const profile = await readSerialProfile(config, serial);
      if (profile) refreshed.push(profile);
    }
    return refreshed;
  }
  const found: AdsPowerProfile[] = [];
  let misses = 0;
  for (let serial = 1; serial <= SERIAL_SCAN_LIMIT; serial++) {
    const profile = await readSerialProfile(config, String(serial));
    if (profile) {
      found.push(profile);
      misses = 0;
      continue;
    }
    misses += 1;
    if (misses >= SERIAL_MISS_LIMIT) break;
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
    if (isPaidAdsPowerListError(message)) throw error;
    return undefined;
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
