import {
  businessIdForEmpresa,
  businessUsersSettingsUrl,
  clampBatchSize,
  EMAIL_CONFIRM_EMPTY_POLLS,
  EMAIL_CONFIRM_POLL_MS,
  empresaChromeBlocksEdit,
  executableEtapas,
  etapaHref,
  FARM_ETAPAS,
  isDuplicatePortfolioError,
  isSuiteUnavailable,
  normalizePortfolioName,
  mergePortfolioChrome,
  portfolioConfirmedOnSettings,
  portfolioEtapaConcluida,
  portfolioNeedsSwitcher,
  portfolioIsCurrent,
  portfolioListed,
  portfolioListedAction,
  portfolioResumeAction,
  PORTFOLIO_FIELDS,
  PORTFOLIO_URL,
  shouldGenerateEmpresaPhone,
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
  it("declara o pipeline completo e executa portfólio e informações da empresa", () => {
    expect(FARM_ETAPAS.map((item) => item.id)).toEqual([
      "portfolio",
      "empresa",
      "email_confirm",
      "whatsapp",
      "verificacao_dados",
      "verificacao_documento",
      "verificacao_sms",
      "verificacao_nome",
      "verificacao_endereco",
      "verificacao_contato",
    ]);
    expect(FARM_ETAPAS[0]?.status).toBe("ready");
    expect(FARM_ETAPAS[1]?.status).toBe("ready");
    expect(FARM_ETAPAS[2]?.status).toBe("ready");
    expect(FARM_ETAPAS[0]?.url).toBe(PORTFOLIO_URL);
    expect(executableEtapas().map((item) => item.id)).toEqual(["portfolio", "empresa", "email_confirm"]);
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
    ).toBe(false);
    expect(
      portfolioEtapaConcluida({
        url: EXISTING,
        listedNames: [...SWITCHER, "Vesol Energia Solar Ltda"],
        razaoSocial: "Vesol Energia Solar Ltda",
        storedId: "1393146169269525",
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

  it("etapa 1 sempre gera caixa 22.do nova, mesmo com e-mail do card ou checkbox desligado", () => {
    expect(shouldGeneratePortfolioInbox({ email_comercial: "rafaela@vesol.com.br", usar_email_temporario: false })).toBe(true);
    expect(shouldGeneratePortfolioInbox({ email_comercial: "foo@mail.tm", usar_email_temporario: true })).toBe(true);
    expect(shouldGeneratePortfolioInbox({ email_comercial: "", usar_email_temporario: false })).toBe(true);
    expect(shouldGenerateEmpresaPhone({ telefone: "(47) 3204-3799" })).toBe(true);
    expect(shouldGenerateEmpresaPhone({ telefone: "" })).toBe(true);
    expect(FARM_ETAPAS.find((item) => item.id === "empresa")?.resumo).toMatch(/número virtual/i);
    expect(FARM_ETAPAS.find((item) => item.id === "email_confirm")?.resumo).toMatch(/Gmail\/Outlook\/Hotmail/i);
    expect(EMAIL_CONFIRM_EMPTY_POLLS).toBe(20);
    expect(EMAIL_CONFIRM_POLL_MS).toBe(5000);
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
    expect(
      businessIdForEmpresa({ sessionId: "1618424756678450", storedId: "1629787285455853" }),
    ).toBe("1629787285455853");
    expect(businessIdForEmpresa({ storedId: "1629787285455853" })).toBe("1629787285455853");
    expect(businessIdForEmpresa({ sessionId: "1618424756678450" })).toBe("1618424756678450");
    expect(businessIdForEmpresa({ sessionId: "  ", storedId: "" })).toBeUndefined();
    const users =
      "https://business.facebook.com/latest/settings/business_users/?nav_ref=bm_settings_redirect_migration&bm_redirect_migration=true&business_id=958933373548004";
    expect(
      portfolioConfirmedOnSettings({
        url: users,
        texts: ["Configurações", "Tek Energy Ltda", "Portfólio empresarial", "Pessoas"],
        razaoSocial: "Tek Energy Ltda",
        submitted: true,
      }),
    ).toBe(true);
    expect(
      portfolioConfirmedOnSettings({
        url: users,
        texts: ["Configurações", "Tek Energy Ltda", "Pessoas"],
        razaoSocial: "Tek Energy Ltda",
        submitted: false,
      }),
    ).toBe(false);
    expect(
      portfolioConfirmedOnSettings({
        url: users,
        texts: ["Configurações", "Pba Contabilidade Ltda", "Pessoas"],
        razaoSocial: "Tek Energy Ltda",
        submitted: true,
      }),
    ).toBe(false);
    expect(
      portfolioConfirmedOnSettings({
        url: "https://business.facebook.com/latest/settings/business_info?business_id=1013153098495280",
        texts: [
          "Vesol Energia Solar Ltda",
          "Identificação do portfólio empresarial: 1013153098495280",
          "Detalhes da empresa",
        ],
        razaoSocial: "Vesol Energia Solar Ltda",
        submitted: true,
      }),
    ).toBe(true);
    expect(
      portfolioConfirmedOnSettings({
        url: "https://business.facebook.com/latest/business_home?business_id=1013153098495280",
        texts: ["Vesol Energia Solar Ltda", "Portfólio empresarial"],
        razaoSocial: "Vesol Energia Solar Ltda",
        submitted: true,
      }),
    ).toBe(true);
    const pbaSettings = "https://business.facebook.com/latest/settings/business_info?business_id=1144460734714607";
    const pbaSparse = ["Meta Business Suite", "Links", "Gerenciador de Anúncios", "Configurações", "Ajuda"];
    expect(
      portfolioConfirmedOnSettings({
        url: pbaSettings,
        texts: pbaSparse,
        razaoSocial: "Pba Contabilidade Ltda",
        submitted: true,
      }),
    ).toBe(false);
    expect(
      portfolioConfirmedOnSettings({
        url: pbaSettings,
        texts: mergePortfolioChrome(pbaSparse, ["Pba Contabilidade Ltda\nPortfólio empresarial", "Pba Contabilidade Ltda"]),
        razaoSocial: "Pba Contabilidade Ltda",
        submitted: true,
      }),
    ).toBe(true);
    expect(portfolioNeedsSwitcher({ submitted: true, confirmed: false, url: pbaSettings })).toBe(false);
    expect(portfolioNeedsSwitcher({ submitted: false, confirmed: false, url: pbaSettings })).toBe(true);
    expect(
      portfolioNeedsSwitcher({
        submitted: true,
        confirmed: false,
        url: "https://business.facebook.com/latest/business_home?business_id=1473072758342397",
      }),
    ).toBe(false);
  });

  it("razão na lista do seletor não é o BM aberto — Vesol no chrome, card Solfacil", () => {
    const vesolUrl = "https://business.facebook.com/latest/settings/business_info?business_id=16184247566784500";
    const solfacilId = "39710179128628335";
    const print = [
      "Vesol Energia Solar Ltda",
      "Identificação do portfólio empresarial: 16184247566784500",
      "Informações do portfólio empresarial",
      "Detalhes da empresa",
      "Razão social da empresa",
      "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
      "Endereço",
      "R Carderoverde, 24550",
    ];
    const listed = [...SWITCHER, "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda", "Vesol Energia Solar Ltda"];
    expect(
      portfolioIsCurrent({
        url: vesolUrl,
        texts: print,
        razaoSocial: "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
        storedId: solfacilId,
      }),
    ).toBe(false);
    expect(
      portfolioIsCurrent({
        url: `https://business.facebook.com/latest/settings/business_info?business_id=${solfacilId}`,
        razaoSocial: "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
        storedId: solfacilId,
      }),
    ).toBe(true);
    expect(
      portfolioIsCurrent({
        url: vesolUrl,
        texts: ["Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda", "Identificação do portfólio empresarial: 39710179128628335"],
        razaoSocial: "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
      }),
    ).toBe(true);
    expect(
      portfolioEtapaConcluida({
        url: vesolUrl,
        listedNames: listed,
        razaoSocial: "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
        texts: print,
        storedId: solfacilId,
      }),
    ).toBe(false);
    expect(portfolioListedAction({ listed: true, current: false, storedId: solfacilId })).toBe("goto");
    expect(portfolioListedAction({ listed: true, current: false })).toBe("pause");
    expect(portfolioListedAction({ listed: true, current: true, storedId: solfacilId })).toBe("skip");
    expect(portfolioListedAction({ listed: false, current: false })).toBe("create");
    expect(portfolioResumeAction({ current: false, storedId: "1013153098495280" })).toBeUndefined();
    expect(portfolioResumeAction({ current: true, storedId: "1013153098495280" })).toBe("skip");
    expect(portfolioResumeAction({ current: true })).toBe("skip");
    expect(portfolioResumeAction({ current: false })).toBeUndefined();
    expect(portfolioResumeAction({ current: true, storedId: "1013153098495280", chromeMismatch: true })).toBeUndefined();
    expect(portfolioResumeAction({ current: false, storedId: "1013153098495280", chromeMismatch: true })).toBeUndefined();
    expect(
      portfolioIsCurrent({
        url: "https://business.facebook.com/latest/settings/business_info?business_id=1013153098495280",
        texts: [
          "Vesol Energia Solar Ltda",
          "Identificação do portfólio empresarial: 1013153098495280",
          "Detalhes da empresa",
        ],
        razaoSocial: "Pba Contabilidade Ltda",
        storedId: "1013153098495280",
      }),
    ).toBe(false);
    expect(
      portfolioIsCurrent({
        url: "https://business.facebook.com/latest/business_home?nav_ref=bm_home_redirect&bm_redirect_migration=true&business_id=1013153098495280",
        texts: ["Boa noite, William", "Vesol Energia Solar Ltda", "Portfólio empresarial", "Criar um anúncio"],
        razaoSocial: "Pba Contabilidade Ltda",
        storedId: "1013153098495280",
      }),
    ).toBe(false);
    expect(
      portfolioResumeAction({
        current: portfolioIsCurrent({
          url: "https://business.facebook.com/latest/business_home?business_id=1013153098495280",
          texts: ["Boa noite, William", "Vesol Energia Solar Ltda", "Portfólio empresarial"],
          razaoSocial: "Pba Contabilidade Ltda",
          storedId: "1013153098495280",
        }),
        storedId: "1013153098495280",
      }),
    ).toBeUndefined();
    expect(
      portfolioIsCurrent({
        url: "https://business.facebook.com/latest/business_home?business_id=1473072758342397",
        razaoSocial: "Vesol Energia Solar Ltda",
        storedId: "1013153098495280",
      }),
    ).toBe(false);
    expect(empresaChromeBlocksEdit(print, "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda")).toBe(true);
    expect(empresaChromeBlocksEdit(print, "Vesol Energia Solar Ltda")).toBe(false);
    expect(empresaChromeBlocksEdit(["Detalhes da empresa", "Editar"], "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda")).toBe(
      false,
    );
  });
});
