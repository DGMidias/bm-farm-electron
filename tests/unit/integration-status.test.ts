import { navShowsIntegrationAlert } from "@shared/integration-status";
import { describe, expect, it } from "vitest";

describe("status global das integrações", () => {
  it("mostra ! só em SMS, e-mail e AdsPower quando ok é false", () => {
    const failed = { ok: false, mensagem: "caiu" };
    const ok = { ok: true, mensagem: "ok" };
    expect(navShowsIntegrationAlert("sms", { sms: failed })).toBe(true);
    expect(navShowsIntegrationAlert("email", { email: failed })).toBe(true);
    expect(navShowsIntegrationAlert("adspower", { adspower: failed })).toBe(true);
    expect(navShowsIntegrationAlert("sms", { sms: ok })).toBe(false);
    expect(navShowsIntegrationAlert("sms", {})).toBe(false);
    expect(navShowsIntegrationAlert("farm", { sms: failed, email: failed, adspower: failed })).toBe(false);
    expect(navShowsIntegrationAlert("history", { sms: failed })).toBe(false);
  });
});
