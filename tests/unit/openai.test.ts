import { formatOpenAiStatus, normalizeOpenAiBase, openaiReady, parseCreditFromCosts, parseModelsCount, sanitizeOpenAiKey } from "@shared/openai-view";
import { testOpenAi } from "../../src/main/openai";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("OpenAI conexão", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sanitiza a key e exige URL + chave", () => {
    expect(sanitizeOpenAiKey("  sk-abc 123  ")).toBe("sk-abc123");
    expect(normalizeOpenAiBase("")).toBe("https://api.openai.com/v1");
    expect(normalizeOpenAiBase("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    expect(openaiReady({ apiKey: "", baseUrl: "https://api.openai.com/v1" })).toBe(false);
    expect(openaiReady({ apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" })).toBe(true);
  });

  it("monta o status com models, org e aviso de saldo admin", () => {
    expect(parseModelsCount({ data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] })).toBe(2);
    expect(parseCreditFromCosts({ data: [{ amount: { value: 1.25, currency: "usd" } }] })).toBe("USD 1.25");
    expect(
      formatOpenAiStatus({
        models: 2,
        organization: "org-1",
        usageDenied: true,
        rateLimit: "4999",
      }),
    ).toBe("OpenAI autenticada · org org-1 · 2 modelos · saldo só com chave de admin da org · rate 4999");
    expect(formatOpenAiStatus({ models: 1, credit: "USD 1.25" })).toBe("OpenAI autenticada · 1 modelo · crédito USD 1.25");
  });

  it("sem key falha; /models 200 autentica mesmo se costs for 403", async () => {
    expect(await testOpenAi({ apiKey: "", baseUrl: "" })).toEqual({ ok: false, mensagem: "OpenAI sem API key." });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/models")) {
        return jsonResponse({ data: [{ id: "gpt-4o" }] }, { "openai-organization": "org-x", "x-ratelimit-remaining-requests": "40" });
      }
      return jsonResponse({ error: { message: "nope" } }, {}, 403);
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await testOpenAi({ apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" });
    expect(result.ok).toBe(true);
    expect(result.mensagem).toMatch(/OpenAI autenticada/);
    expect(result.mensagem).toMatch(/1 modelo/);
    expect(result.mensagem).toMatch(/admin da org/);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer sk-test" },
    });
  });

  it("401 no /models derruba a conexão", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "Incorrect API key" } }, {}, 401)));
    const result = await testOpenAi({ apiKey: "sk-bad", baseUrl: "https://api.openai.com/v1" });
    expect(result.ok).toBe(false);
    expect(result.mensagem).toMatch(/Incorrect API key|401/i);
  });
});

function jsonResponse(payload: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
