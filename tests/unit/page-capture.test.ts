import { buildCapture, fingerprintOf, shouldSkipDuplicate } from "@shared/page-capture";
import { describe, expect, it } from "vitest";

describe("captura de tela", () => {
  it("gera fingerprint estável e muda quando o layout muda", () => {
    const first = fingerprintOf(["Nome da sua conta e empresa", "Seu email comercial"], ["textbox:Seu nome"]);
    const same = fingerprintOf(["Seu email comercial", "Nome da sua conta e empresa"], ["textbox:Seu nome"]);
    const other = fingerprintOf(["Business email"], ["textbox:Your name"]);
    expect(first).toBe(same);
    expect(first).not.toBe(other);
  });

  it("guarda labels e anyText no meta", () => {
    const meta = buildCapture({
      url: "https://adsmanager.facebook.com/adsmanager/onboarding",
      title: "Onboarding",
      screenId: "portfolio.form",
      texts: ["Nome da sua conta e empresa", "Criar"],
      labels: [{ role: "textbox", name: "Seu email comercial" }],
    });
    expect(meta.fingerprint).toHaveLength(8);
    expect(meta.labels[0]?.name).toBe("Seu email comercial");
    expect(meta.anyText).toContain("Criar");
  });

  it("grava reason e capturedAt no meta", () => {
    const meta = buildCapture({
      url: "https://adsmanager.facebook.com/adsmanager/onboarding",
      title: "Onboarding",
      screenId: "portfolio.landing",
      reason: "operator",
      texts: ["Começar"],
      labels: [{ role: "link", name: "Criar portfólio empresarial" }],
    });
    expect(meta.reason).toBe("operator");
    expect(meta.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(meta.screenId).toBe("portfolio.landing");
  });

  it("só evita duplicata em captura automática", () => {
    expect(shouldSkipDuplicate("auto", true)).toBe(true);
    expect(shouldSkipDuplicate("auto", false)).toBe(false);
    expect(shouldSkipDuplicate("error", true)).toBe(false);
    expect(shouldSkipDuplicate("operator", true)).toBe(false);
  });
});
