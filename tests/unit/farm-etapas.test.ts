import {
  businessUsersSettingsUrl,
  clampBatchSize,
  executableEtapas,
  etapaHref,
  FARM_ETAPAS,
  isDuplicatePortfolioError,
  isSuiteUnavailable,
  normalizePortfolioName,
  portfolioEtapaConcluida,
  portfolioListed,
  PORTFOLIO_FIELDS,
  PORTFOLIO_URL,
  shouldGeneratePortfolioInbox,
  shouldRedirectToBusinessUsers,
  SKIP_COMPLETED_ETAPA,
  withBusinessId,
} from "@shared/farm-etapas";
import { formatEtapaSkippedLog } from "@shared/farm-log";
import { describe, expect, it } from "vitest";

const EXISTING =
  "https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=1393146169269525&asset_id=1404934486035164";

const SWITCHER = ["Debra R. Rocha", "Emerson Market", "O2M", "Top Sun Service"];

describe("etapas do farm", () => {
  it("declara o pipeline completo e só o portfólio executável", () => {
    expect(FARM_ETAPAS.map((item) => item.id)).toEqual([
      "portfolio",
      "empresa",
      "whatsapp",
      "verificacao_dados",
      "verificacao_documento",
      "verificacao_sms",
      "verificacao_nome",
      "verificacao_endereco",
      "verificacao_contato",
    ]);
    expect(FARM_ETAPAS[0]?.status).toBe("ready");
    expect(FARM_ETAPAS[0]?.url).toBe(PORTFOLIO_URL);
    expect(executableEtapas()).toEqual([FARM_ETAPAS[0]]);
    expect(PORTFOLIO_FIELDS).toHaveLength(4);
    expect(PORTFOLIO_FIELDS.map((item) => item.key)).toEqual(["razao_social", "nome", "sobrenome", "email_comercial"]);
    expect(clampBatchSize(0, 4)).toBe(1);
    expect(clampBatchSize(9, 3)).toBe(3);
  });

  it("só pula a etapa 1 se a razão social estiver na lista do seletor", () => {
    expect(SKIP_COMPLETED_ETAPA).toBe(true);
    expect(normalizePortfolioName("  Vesol   Energia Solar  Ltda ")).toBe("vesol energia solar ltda");
    expect(portfolioListed(SWITCHER, "Vesol Energia Solar Ltda")).toBe(false);
    expect(portfolioListed(SWITCHER, "Bmnovaativa")).toBe(false);
    expect(portfolioListed(["Bmnovaativa"], "Vesol Energia Solar Ltda")).toBe(false);
    expect(portfolioListed([...SWITCHER, "Vesol  Energia Solar Ltda"], "Vesol Energia Solar Ltda")).toBe(true);
    expect(
      portfolioListed(
        [
          "Debra R. Rocha 1 ativo de negócios",
          "Emerson Market 0 ativos de negócios",
          "O2M Solucoes em Ti Ltda 0 ativos de negócios",
          "Pba Contabilidade Ltda 0 ativos de negócios",
          "Top Sun Service Ltda 0 ativos de negócios",
        ],
        "Pba Contabilidade Ltda",
      ),
    ).toBe(true);
    expect(
      isDuplicatePortfolioError([
        "Escolha outro nome para seu portfólio empresarial",
        "Você está tentando criar um portfólio empresarial com o mesmo nome de um à qual você já tem acesso.",
      ]),
    ).toBe(true);
    expect(isDuplicatePortfolioError(["Portfólios empresariais", "Criar um portfólio empresarial"])).toBe(false);
    expect(portfolioEtapaConcluida({ screenId: "portfolio.existing", url: EXISTING })).toBe(false);
    expect(portfolioEtapaConcluida({ url: EXISTING })).toBe(false);
    expect(portfolioEtapaConcluida({ screenId: "portfolio.landing", url: PORTFOLIO_URL })).toBe(false);
    expect(
      portfolioEtapaConcluida({
        url: EXISTING,
        listedNames: SWITCHER,
        razaoSocial: "Vesol Energia Solar Ltda",
      }),
    ).toBe(false);
    expect(
      portfolioEtapaConcluida({
        url: EXISTING,
        listedNames: [...SWITCHER, "Vesol Energia Solar Ltda"],
        razaoSocial: "Vesol Energia Solar Ltda",
      }),
    ).toBe(true);
    const log = formatEtapaSkippedLog({
      etapa: "portfolio",
      pageName: "Vesol Energia Solar Ltda",
      listed: true,
    });
    expect(log).toBe("Etapa portfolio já concluída · pulando · Vesol Energia Solar Ltda · listada no seletor");
    expect(log).not.toMatch(/desconhecida|erro/i);
  });

  it("etapa 1 sempre gera caixa mail.tm nova, mesmo com e-mail do card ou checkbox desligado", () => {
    expect(shouldGeneratePortfolioInbox({ email_comercial: "rafaela@vesol.com.br", usar_email_temporario: false })).toBe(true);
    expect(shouldGeneratePortfolioInbox({ email_comercial: "foo@mail.tm", usar_email_temporario: true })).toBe(true);
    expect(shouldGeneratePortfolioInbox({ email_comercial: "", usar_email_temporario: false })).toBe(true);
  });

  it("depois de criar, a suite vazia com business_id vai para pessoas do portfólio — sem pedir seletor", () => {
    const home = "https://business.facebook.com/latest/home?business_id=1618424756678450";
    const settings =
      "https://business.facebook.com/latest/settings/business_users/?nav_ref=bm_settings_redirect_migration&bm_redirect_migration=true&business_id=1618424756678450";
    const texts = [
      "Não é possível acessar o Meta Business Suite com esta conta",
      "Sua conta, Cadef, não tem acesso a Páginas do Facebook ou perfis do Instagram que podem ser gerenciados no Meta Business Suite",
    ];
    expect(isSuiteUnavailable(texts)).toBe(true);
    expect(isSuiteUnavailable(["Etapas para começar", "Meta Business Suite", "Criar post"])).toBe(false);
    expect(isSuiteUnavailable(["O que você quer adicionar a este portfólio empresarial?", "Avançar"])).toBe(false);
    expect(businessUsersSettingsUrl("1618424756678450")).toBe(settings);
    expect(shouldRedirectToBusinessUsers({ url: home, texts })).toBe(settings);
    expect(shouldRedirectToBusinessUsers({ url: settings, texts })).toBeUndefined();
    expect(
      shouldRedirectToBusinessUsers({
        url: home,
        texts: ["Etapas para começar", "Meta Business Suite", "Criar post"],
      }),
    ).toBeUndefined();
    expect(withBusinessId("https://business.facebook.com/latest/settings/business_info", "1618424756678450")).toContain(
      "business_id=1618424756678450",
    );
    expect(etapaHref(FARM_ETAPAS.find((item) => item.id === "empresa")!, "1618424756678450")).toContain(
      "business_id=1618424756678450",
    );
    expect(etapaHref(FARM_ETAPAS.find((item) => item.id === "empresa")!, "1618424756678450")).toContain("business_info");
    expect(etapaHref(FARM_ETAPAS.find((item) => item.id === "empresa")!)).toBe(
      "https://business.facebook.com/latest/settings/business_info",
    );
  });
});
