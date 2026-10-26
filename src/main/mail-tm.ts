import type { EmailConfig, MailMessage } from "@shared/types";

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
    throw new Error(`mail.tm ${path} falhou (${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function createInbox(config: EmailConfig): Promise<{ address: string; token: string; password: string }> {
  const domains = await json<{ "hydra:member"?: Array<{ domain: string }> }>("/domains");
  const domain = domains["hydra:member"]?.[0]?.domain;
  if (!domain) throw new Error("mail.tm não retornou domínio.");
  const local = `bm${Math.random().toString(36).slice(2, 10)}`;
  const address = `${local}@${domain}`;
  const password = config.password || `Tmp-${Math.random().toString(36).slice(2, 12)}`;
  await json("/accounts", {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });
  const tokenRes = await json<{ token: string }>("/token", {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });
  return { address, token: tokenRes.token, password };
}

export async function listMessages(token: string): Promise<MailMessage[]> {
  const data = await json<{ "hydra:member"?: Array<{ id: string; from?: { address?: string }; subject?: string; intro?: string }> }>(
    "/messages",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return (data["hydra:member"] ?? []).map((item) => ({
    id: item.id,
    from: item.from?.address ?? "",
    subject: item.subject ?? "",
    intro: item.intro ?? "",
  }));
}

export function extractValidationCode(text: string): string | undefined {
  const match = text.match(/\b(\d{4,8})\b/);
  return match?.[1];
}
