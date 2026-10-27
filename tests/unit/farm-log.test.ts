import {
  arrivedAtExistingPortfolio,
  businessIdFromUrl,
  formatExistingBmLog,
  formatFarmDetachLog,
  formatSuiteUnavailableRedirectLog,
  formatPortfolioCreatedLog,
  formatPortfolioFilledLog,
  formatPortfolioRedirectLog,
  formatTempEmailLog,
  KEEP_ADSPOWER_OPEN_ON_END,
  shouldLogDetach,
} from "@shared/farm-log";
import { describe, expect, it } from "vitest";

describe("log de execução do farm", () => {
  it("nunca fecha AdsPower nem aba ao encerrar o worker", () => {
    expect(KEEP_ADSPOWER_OPEN_ON_END).toBe(true);
    expect(formatFarmDetachLog("2")).toMatch(/perfil 2/);
    expect(formatFarmDetachLog("2")).toMatch(/abertos para conferência/i);
    expect(formatFarmDetachLog("2")).not.toMatch(/encerrada|fechada/i);
  });

  it("o log de preenchimento e criação traz nome, responsável, e-mail e business_id", () => {
    const filled = formatPortfolioFilledLog({
      razaoSocial: "Vesol Energia Solar Ltda",
      responsavel: "Rafaela Vesol",
      email: "rafaela@vesol.com.br",
      keys: ["razao_social", "responsavel", "email_comercial"],
    });
    expect(filled).toContain("Vesol Energia Solar Ltda");
    expect(filled).toContain("Rafaela Vesol");
    expect(filled).toContain("rafaela@vesol.com.br");
    expect(filled).toContain("3 campos");

    const created = formatPortfolioCreatedLog({
      razaoSocial: "Vesol Energia Solar Ltda",
      responsavel: "Rafaela Vesol",
      email: "rafaela@vesol.com.br",
      url: "https://business.facebook.com/latest/home?business_id=1393146169269525",
    });
    expect(created).toContain("Vesol Energia Solar Ltda");
    expect(created).toContain("rafaela@vesol.com.br");
    expect(created).toContain("business_id=1393146169269525");
    expect(created).toContain("https://business.facebook.com/latest/home");
    expect(formatTempEmailLog({ address: "foo@mail.tm", razaoSocial: "Vesol Energia Solar Ltda", profile: "2" })).toBe(
      "E-mail temporário · foo@mail.tm · Vesol · perfil 2",
    );
  });

  it("landing que cai num BM existente não conta como criação", () => {
    const url =
      "https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=1393146169269525&asset_id=1404934486035164";
    expect(arrivedAtExistingPortfolio(url)).toBe(true);
    expect(arrivedAtExistingPortfolio("https://business.facebook.com/latest/settings/business_info")).toBe(false);
    expect(businessIdFromUrl(url)).toBe("1393146169269525");
    const redirect = formatPortfolioRedirectLog({
      cta: "Criar portfólio empresarial",
      pageName: "Bmnovaativa",
      url,
    });
    expect(redirect).toContain("Criar portfólio empresarial");
    expect(redirect).toContain("Bmnovaativa");
    expect(redirect).toContain("business_id=1393146169269525");
    expect(redirect).not.toMatch(/criado/i);

    const existing = formatExistingBmLog({ pageName: "Bmnovaativa", url });
    expect(existing).toContain("Bmnovaativa");
    expect(existing).toContain("1393146169269525");
    expect(existing).toMatch(/já tem/i);
    expect(existing).not.toMatch(/desconhecida/i);

    const unavailable = formatSuiteUnavailableRedirectLog({
      businessId: "1618424756678450",
      url: "https://business.facebook.com/latest/settings/business_users/?business_id=1618424756678450",
    });
    expect(unavailable).toContain("1618424756678450");
    expect(unavailable).toMatch(/suite indisponível/i);
    expect(unavailable).not.toMatch(/desconhecida|seletor/i);
  });

  it("não loga CDP solto de novo nem com perfil vazio", () => {
    expect(shouldLogDetach("2", false)).toBe(true);
    expect(shouldLogDetach("2", true)).toBe(false);
    expect(shouldLogDetach("", false)).toBe(false);
    expect(shouldLogDetach(undefined, false)).toBe(false);
  });
});
