import { platformId } from "@harness/compat";
import type { AdsPowerConfig, ConnectionResult } from "@shared/types";

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
    throw new Error(msg);
  }
  return payload.data ?? {};
}

export async function testAdsPower(config: AdsPowerConfig): Promise<ConnectionResult> {
  try {
    await adspowerRequest(config, "/status");
    return { ok: true, mensagem: `AdsPower ok em ${config.baseUrl} (${platformId()}).` };
  } catch (error) {
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha no AdsPower." };
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
