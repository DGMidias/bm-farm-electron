import { readFileSync } from "node:fs";
import { joinPath } from "@harness/compat";
import { detectScreen, snapshotFromTexts, type PageMap } from "@shared/map";
import { describe, expect, it } from "vitest";

const map = JSON.parse(readFileSync(joinPath(process.cwd(), "mapas", "meta-bm.v1.json"), "utf8")) as PageMap;

const ONBOARDING = "https://adsmanager.facebook.com/adsmanager/onboarding?nav_source=fb4b";

describe("mapa de páginas", () => {
  it("reconhece login, empresa e captcha", () => {
    expect(detectScreen(map, snapshotFromTexts("https://business.facebook.com/login", "Login", ["Entrar", "Senha"])).id).toBe("login");
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/business/loginpage/?login_options%5B0%5D=FB&config_ref=biz_login_tool_flavor_mbs",
          "Comece a usar as ferramentas",
          ["Comece a usar as ferramentas de negócios", "Continuar com o Facebook"],
        ),
      ).id,
    ).toBe("login");
    expect(
      detectScreen(map, snapshotFromTexts("https://business.facebook.com/latest/settings/business_info", "Info", ["Razão social da empresa"])).id,
    ).toBe("empresa.info");
    expect(detectScreen(map, snapshotFromTexts("https://business.facebook.com/", "X", ["Não sou um robô"])).human).toBe("captcha");
  });

  it("reconhece a landing do onboarding pelos CTAs, não pelo formulário", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts(ONBOARDING, "Integração guiada", [
          "Alcance as pessoas certas com o Gerenciador de Anúncios",
          "Começar",
          "Precisa criar um portfólio empresarial primeiro?",
          "Criar portfólio empresarial",
        ]),
      ).id,
    ).toBe("portfolio.landing");
  });

  it("loginpage com o modal de 3 campos é formulário, não login", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/business/loginpage/?login_options%5B0%5D=FB&create_business_portfolio_for_bm=1",
          "Entrar na conta do Meta Business Suite",
          [
            "Comece a usar as ferramentas corporativas da Meta",
            "Continuar com o Facebook",
            "Crie seu portfólio empresarial no Gerenciador de Negócios",
            "Nome da sua conta e empresa",
            "Seu nome",
            "Seu email comercial",
            "Enviar",
          ],
        ),
      ).id,
    ).toBe("portfolio.form");
  });

  it("reconhece o modal do portfólio pelos rótulos dos campos", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts(ONBOARDING, "Crie seu portfólio", [
          "Nome da sua conta e empresa",
          "Seu email comercial",
        ]),
      ).id,
    ).toBe("portfolio.form");
    expect(
      detectScreen(
        map,
        snapshotFromTexts("https://business.facebook.com/latest/home", "Criar um portfólio empresarial", [
          "Nome do portfólio empresarial",
          "Nome",
          "Sobrenome",
          "Email comercial",
        ]),
      ).id,
    ).toBe("portfolio.create");
    expect(
      detectScreen(
        map,
        snapshotFromTexts("https://business.facebook.com/latest/home", "Seletor", ["Portfólios empresariais", "Debra R. Rocha"]),
      ).id,
    ).toBe("portfolio.switcher");
  });

  it("não classifica onboarding sem texto de landing nem de formulário", () => {
    expect(detectScreen(map, snapshotFromTexts(ONBOARDING, "Gerenciador de Anúncios", [])).id).toBe("unknown");
  });

  it("reconhece o assistente depois de criar o portfólio", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts("https://business.facebook.com/latest/home", "Pessoas", [
          "Adicione pessoas a este portfólio empresarial",
          "Avançar",
        ]),
      ).id,
    ).toBe("portfolio.add_people");
    expect(
      detectScreen(
        map,
        snapshotFromTexts("https://business.facebook.com/latest/home", "Confirmar", [
          "Analise e confirme seu portfólio empresarial",
          "Confirmar",
        ]),
      ).id,
    ).toBe("portfolio.confirm");
  });

  it("reconhece o modal de adicionar ativos depois de criar", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts("https://business.facebook.com/latest/home", "Adicionar", [
          "O que você quer adicionar a este portfólio empresarial?",
          "Não há nada disponível para ser reivindicado",
          "Pular",
          "Avançar",
        ]),
      ).id,
    ).toBe("portfolio.add_assets");
  });

  it("reconhece o home de um BM já existente", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=1393146169269525&asset_id=1404934486035164",
          "Meta Business Suite",
          ["Etapas para começar", "Bmnovaativa", "Criar post", "Meta Business Suite"],
        ),
      ).id,
    ).toBe("portfolio.existing");
  });

  it("distingue a suite vazia (sem Páginas) do home que já funciona", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/latest/home?business_id=1618424756678450",
          "Meta Business Suite",
          [
            "Não é possível acessar o Meta Business Suite com esta conta",
            "Sua conta, Cadef, não tem acesso a Páginas do Facebook ou perfis do Instagram que podem ser gerenciados no Meta Business Suite",
          ],
        ),
      ).id,
    ).toBe("portfolio.unavailable");
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/latest/settings/business_users/?nav_ref=bm_settings_redirect_migration&bm_redirect_migration=true&business_id=1618424756678450",
          "Pessoas",
          ["Pessoas", "Adicionar pessoas"],
        ),
      ).id,
    ).toBe("portfolio.settings_users");
  });

  it("reconhece o modal de detalhes da empresa", () => {
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/latest/settings/business_info?business_id=1618424756678450",
          "Editar detalhes da empresa",
          [
            "Editar detalhes da empresa",
            "Razão social da empresa",
            "País",
            "Identificação fiscal (EIN)",
            "Salvar",
          ],
        ),
      ).id,
    ).toBe("empresa.details_form");
    expect(
      detectScreen(
        map,
        snapshotFromTexts(
          "https://business.facebook.com/latest/settings/business_info?business_id=1618424756678450",
          "Meta Business Suite",
          [
            "Informações do portfólio empresarial",
            "Editar",
            "Detalhes da empresa",
            "Editar",
            "Razão social da empresa",
            "Sem nome",
            "Endereço",
            "Sem endereço",
          ],
        ),
      ).id,
    ).toBe("empresa.info");
  });
});
