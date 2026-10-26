import { extractValidationCode } from "../../src/main/mail-tm";
import { smsReady } from "../../src/main/sms";
import { describe, expect, it } from "vitest";

describe("adapters", () => {
  it("extrai código da validação", () => {
    expect(extractValidationCode("Seu código é 482913 e expira em 10 minutos.")).toBe("482913");
  });

  it("SMS só fica pronto com URL e chave", () => {
    expect(smsReady({ baseUrl: "", apiKey: "x" })).toBe(false);
    expect(smsReady({ baseUrl: "https://app.numero-virtual.com.br", apiKey: "x" })).toBe(true);
  });
});
