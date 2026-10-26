import type { ConnectionResult, SmsConfig } from "@shared/types";

export async function testSms(config: SmsConfig): Promise<ConnectionResult> {
  if (!config.baseUrl.trim()) {
    return { ok: false, mensagem: "Informe a URL da API de SMS." };
  }
  if (!config.apiKey.trim()) {
    return { ok: false, mensagem: "SMS só testa conexão com a API key preenchida." };
  }
  try {
    const url = new URL("/developers", config.baseUrl);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
      return {
        ok: response.ok,
        mensagem: response.ok
          ? "Provedor de SMS respondeu."
          : `Provedor alcançado, status ${response.status}. Confira a chave em app.numero-virtual.com.br/developers.`,
      };
    }
    return { ok: false, mensagem: `SMS retornou HTTP ${response.status}.` };
  } catch (error) {
    return { ok: false, mensagem: error instanceof Error ? error.message : "Falha ao falar com o SMS." };
  }
}

export function smsReady(config: SmsConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim());
}
