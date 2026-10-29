import { emptyEmpresa } from "@shared/empresa";
import {
  adsPolicyButtonNames,
  clickAdsPolicy,
  clickContinueSession,
  clickCreateButton,
  clickSwitcherCreate,
  extractBusinessPortfolioNames,
  farmLocatorTexts,
  fillPortfolioFields,
  clickPostCreateStep,
  isAdsPolicyDialog,
  isAdsPolicyThanks,
  isLoginChooser,
  isPortfolioCreateForm,
  openPortfolioModal,
  openSwitcher,
  postCreateStep,
  PROFILE_SPECIFIC_FORBIDDEN,
  portfolioLooksCreated,
  shouldClickContinueSession,
  splitFacebookName,
  type Clickable,
  type Fillable,
} from "@shared/portfolio-fill";
import { describe, expect, it } from "vitest";

function fakeScope(items: Array<string | { role: string; name: string }>, options: { failNames?: string[] } = {}) {
  const filled: Record<string, string> = {};
  const clicks: string[] = [];
  const names = items.map((item) => (typeof item === "string" ? item : item.name));
  const present = (role: string | undefined, name: string | RegExp) =>
    items.some((item) => {
      if (typeof item === "string") return typeof name === "string" ? item === name : name.test(item);
      if (role && item.role !== role) return false;
      return typeof name === "string" ? item.name === name : name.test(item.name);
    });
  const fillable = (name: string): Fillable => ({
    count: async () => (names.includes(name) ? 1 : 0),
    fill: async (value: string) => {
      filled[name] = value;
    },
  });
  const clickable = (role: string, name?: string | RegExp): Clickable => ({
    count: async () => {
      if (name === undefined) return items.filter((item) => typeof item !== "string" && item.role === role).length;
      return present(role, name) ? 1 : 0;
    },
    first: () => ({
      click: async () => {
        const label = name === undefined
          ? (() => {
              const hit = items.find((item) => typeof item !== "string" && item.role === role);
              return hit && typeof hit !== "string" ? `${hit.role}:${hit.name}` : "";
            })()
          : name instanceof RegExp
            ? (() => {
                const hit = items.find((item) => typeof item !== "string" && item.role === role && name.test(item.name));
                return hit && typeof hit !== "string" ? hit.name : name.source;
              })()
          : String(name);
        if (label && options.failNames?.includes(typeof name === "string" ? name : label.split(":").slice(1).join(":"))) {
          throw new Error("intercepts pointer events");
        }
        clicks.push(label);
      },
    }),
  });
  return {
    filled,
    clicks,
    getByLabel: (name: string) => fillable(name),
    getByPlaceholder: (name: string) => fillable(name),
    getByRole: (role: string, options?: { name?: string | RegExp }) => clickable(role, options?.name),
  };
}

describe("preenchimento do portfólio", () => {
  it("preenche os 4 campos do modal pelo seletor", async () => {
    const card = emptyEmpresa("e1");
    card.razao_social = "Vesol Energia Solar Ltda";
    const scope = fakeScope([
      "Nome do portfólio empresarial",
      "Nome",
      "Sobrenome",
      "Email comercial",
      "Criar",
    ]);
    const result = await fillPortfolioFields(scope, {
      razao_social: card.razao_social,
      nome: "Jesus",
      sobrenome: "Ferreyra",
      email_comercial: "foo@mail.tm",
    });
    expect(result.filled).toBe(4);
    expect(result.keys).toEqual(["razao_social", "nome", "sobrenome", "email_comercial"]);
    expect(scope.filled["Nome do portfólio empresarial"]).toBe("Vesol Energia Solar Ltda");
    expect(scope.filled.Nome).toBe("Jesus");
    expect(scope.filled.Sobrenome).toBe("Ferreyra");
    expect(scope.filled["Email comercial"]).toBe("foo@mail.tm");
    expect(await clickCreateButton(scope)).toBe("Criar");
    expect(scope.clicks).toContain("Criar");
  });

  it("preenche o modal de 3 campos do Gerenciador e envia", async () => {
    const scope = fakeScope(["Nome da sua conta e empresa", "Seu nome", "Seu email comercial", "Enviar"]);
    const result = await fillPortfolioFields(scope, {
      razao_social: "Jasper's Market",
      nome: "Henrique",
      sobrenome: "Weber",
      email_comercial: "foo@mail.tm",
    });
    expect(result.variant).toBe("onboarding");
    expect(result.filled).toBe(3);
    expect(result.keys).toEqual(["razao_social", "responsavel", "email_comercial"]);
    expect(scope.filled["Seu nome"]).toBe("Henrique Weber");
    expect(await clickCreateButton(scope)).toBe("Enviar");
  });

  it("não clica no chooser quando o modal de 3 campos já está aberto", () => {
    const truncatedSnapshot = [
      "Comece a usar as ferramentas corporativas da Meta",
      "Ao fazer login, você pode navegar para todas as ferramentas comerciais",
      "Entrar nas ferramentas comerciais da Meta",
      "Continuar com o Facebook",
      "Continuar com o Instagram",
      "Criar nova conta",
    ];
    expect(isLoginChooser(truncatedSnapshot)).toBe(true);
    expect(isPortfolioCreateForm(truncatedSnapshot)).toBe(false);
    expect(shouldClickContinueSession({ texts: truncatedSnapshot, formOpen: true })).toBe(false);
    expect(shouldClickContinueSession({ texts: truncatedSnapshot, formOpen: false })).toBe(true);
    expect(
      isPortfolioCreateForm([
        "Crie seu portfólio empresarial no Gerenciador de Negócios",
        "Nome da sua conta e empresa",
        "Seu nome",
        "Seu email comercial",
        "Enviar",
      ]),
    ).toBe(true);
    expect(
      shouldClickContinueSession({
        texts: [...truncatedSnapshot, "Crie seu portfólio empresarial no Gerenciador de Negócios", "Nome da sua conta e empresa"],
      }),
    ).toBe(false);
  });

  it("preenche empresa e e-mail e não apaga Seu nome já preenchido", async () => {
    const scope = fakeScope(["Nome da sua conta e empresa", "Seu nome", "Seu email comercial", "Enviar"]);
    const result = await fillPortfolioFields(scope, {
      razao_social: "Pba Contabilidade Ltda",
      nome: "",
      sobrenome: "",
      email_comercial: "foo@mail.tm",
    });
    expect(result.variant).toBe("onboarding");
    expect(result.keys).toEqual(["razao_social", "email_comercial"]);
    expect(scope.filled["Nome da sua conta e empresa"]).toBe("Pba Contabilidade Ltda");
    expect(scope.filled["Seu email comercial"]).toBe("foo@mail.tm");
    expect(scope.filled["Seu nome"]).toBeUndefined();
    expect(await clickCreateButton(scope)).toBe("Enviar");
  });

  it("reconhece o diálogo de não discriminação e clica Aceito, depois Concluir", async () => {
    const policy = [
      "Criar portfólio empresarial",
      "Para ajudar a manter a integridade da publicidade da Meta, leia e aceite nossa política de não discriminação.",
      "Política de Não Discriminação",
      "Ao clicar em Aceito, você confirma que:",
      "Aceito",
    ];
    const thanks = [
      "Criar portfólio empresarial",
      "Agradecemos a sua aceitação da nossa Política de Não Discriminação",
      "Concluir",
    ];
    expect(isAdsPolicyDialog(policy)).toBe(true);
    expect(isAdsPolicyThanks(thanks)).toBe(true);
    expect(adsPolicyButtonNames(policy)).toEqual(["Aceito", "I Accept"]);
    expect(adsPolicyButtonNames(thanks)).toEqual(["Concluir", "Done", "Finish"]);
    expect(isAdsPolicyDialog(["Criar portfólio empresarial", "Começar"])).toBe(false);
    const accept = fakeScope([{ role: "button", name: "Aceito" }, { role: "link", name: "Criar portfólio empresarial" }]);
    expect(await clickAdsPolicy(accept, policy)).toBe("Aceito");
    expect(accept.clicks).toEqual(["Aceito"]);
    const done = fakeScope([{ role: "button", name: "Concluir" }]);
    expect(await clickAdsPolicy(done, thanks)).toBe("Concluir");
    expect(done.clicks).toEqual(["Concluir"]);
  });

  it("no chooser da Meta clica Continuar com o Facebook, sem tratar como logout", async () => {
    const scope = fakeScope([{ role: "button", name: "Continuar com o Facebook" }, { role: "button", name: "Criar nova conta" }]);
    expect(await clickContinueSession(scope)).toBe("Continuar com o Facebook");
    expect(scope.clicks).toEqual(["Continuar com o Facebook"]);
  });

  it("lê só Portfólios empresariais e ignora página/Instagram", () => {
    const names = extractBusinessPortfolioNames([
      "Pesquisar",
      "Portfólios empresariais",
      "Debra R. Rocha",
      "Emerson Market",
      "O2M",
      "Top Sun Service",
      "Criar um portfólio empresarial",
      "Páginas",
      "Bmnovaativa",
      "Contas do Instagram",
    ]);
    expect(names).toEqual(["Debra R. Rocha", "Emerson Market", "O2M", "Top Sun Service"]);
    expect(names).not.toContain("Bmnovaativa");
    expect(
      extractBusinessPortfolioNames([
        "Portfólios empresariais",
        "Debra R. Rocha",
        "1 ativo de negócios",
        "Pba Contabilidade Ltda",
        "0 ativos de negócios",
        "Criar um portfólio empresarial",
      ]),
    ).toEqual(["Debra R. Rocha", "Pba Contabilidade Ltda"]);
  });

  it("parte o nome do Facebook no primeiro e no último token", () => {
    expect(splitFacebookName("Jesus Ferreyra")).toEqual({ nome: "Jesus", sobrenome: "Ferreyra" });
    expect(splitFacebookName("  Maria de Jesus Ferreyra ")).toEqual({ nome: "Maria", sobrenome: "Ferreyra" });
    expect(splitFacebookName("Jesus")).toBeUndefined();
    expect(splitFacebookName("")).toBeUndefined();
    expect(splitFacebookName("Conheça o Meta Business Suite")).toBeUndefined();
  });

  it("depois de criar, avança o assistente e confirma", async () => {
    expect(postCreateStep(["O que você quer adicionar a este portfólio empresarial?", "Avançar", "Pular"])).toBe(
      "add_assets",
    );
    expect(postCreateStep(["Adicione pessoas a este portfólio empresarial", "Avançar", "Pular"])).toBe("add_people");
    expect(postCreateStep(["Analise e confirme seu portfólio empresarial", "Confirmar"])).toBe("confirm");
    expect(postCreateStep(["Portfólios empresariais", "Etapas para começar"])).toBeUndefined();
    const first = fakeScope([
      { role: "button", name: "Pular" },
      { role: "button", name: "Avançar" },
    ]);
    expect(await clickPostCreateStep(first, "add_assets")).toBe("Avançar");
    expect(first.clicks).toEqual(["Avançar"]);
    const people = fakeScope([
      { role: "button", name: "Pular" },
      { role: "button", name: "Avançar" },
    ]);
    expect(await clickPostCreateStep(people, "add_people")).toBe("Avançar");
    const review = fakeScope([
      { role: "button", name: "Voltar" },
      { role: "button", name: "Confirmar" },
    ]);
    expect(await clickPostCreateStep(review, "confirm")).toBe("Confirmar");
    expect(review.clicks).toEqual(["Confirmar"]);
  });

  it("só marca portfólio criado depois de enviar o formulário", () => {
    const home = "https://business.facebook.com/latest/home?business_id=1393146169269525";
    expect(portfolioLooksCreated(home, { dialogOpen: false, submitted: false })).toBe(false);
    expect(portfolioLooksCreated(home, { dialogOpen: false, submitted: true })).toBe(true);
    expect(portfolioLooksCreated("https://adsmanager.facebook.com/adsmanager/manage?business_id=1", { submitted: true })).toBe(true);
    expect(portfolioLooksCreated("https://adsmanager.facebook.com/adsmanager/onboarding", { submitted: true })).toBe(false);
  });

  it("abre o modal pelo link Criar portfólio empresarial, não pelo botão Criar", async () => {
    const scope = fakeScope([
      { role: "link", name: "Criar portfólio empresarial" },
      { role: "button", name: "Começar" },
      { role: "button", name: "Criar" },
    ]);
    expect(await openPortfolioModal(scope)).toBe("Criar portfólio empresarial");
    expect(scope.clicks).toEqual(["Criar portfólio empresarial"]);
    expect(await clickCreateButton(scope)).toBe("Criar");
    expect(scope.clicks).toEqual(["Criar portfólio empresarial", "Criar"]);
  });

  it("se o link da landing falha o clique, tenta Começar", async () => {
    const scope = fakeScope(
      [
        { role: "link", name: "Criar portfólio empresarial" },
        { role: "button", name: "Começar" },
      ],
      { failNames: ["Criar portfólio empresarial"] },
    );
    expect(await openPortfolioModal(scope)).toBe("Começar");
    expect(scope.clicks).toEqual(["Começar"]);
  });

  it("abre o seletor pelo combobox do chrome, nunca 2FA nem o nome do ativo", async () => {
    const branded = fakeScope([
      { role: "button", name: "Bmnovaativa" },
      { role: "heading", name: "Bmnovaativa" },
      { role: "combobox", name: "Ninguém" },
      { role: "combobox", name: "Outra Marca Qualquer, Portfólio empresarial" },
      { role: "button", name: "Criar um portfólio empresarial" },
    ]);
    expect(await openSwitcher(branded)).toBe(true);
    expect(branded.clicks).toEqual(["Outra Marca Qualquer, Portfólio empresarial"]);
    expect(branded.clicks.join(" ")).not.toMatch(/Ninguém|Bmnovaativa/i);
    const home = fakeScope([
      { role: "combobox", name: "Ninguém" },
      { role: "combobox", name: "William Rodrigues Santos Vendas Ltda" },
    ]);
    expect(await openSwitcher(home)).toBe(true);
    expect(home.clicks).toEqual(["William Rodrigues Santos Vendas Ltda"]);
    expect(home.clicks.join(" ")).not.toMatch(/Ninguém/i);
    expect(farmLocatorTexts().join("\n")).not.toMatch(PROFILE_SPECIFIC_FORBIDDEN);
  });

  it("cria pelo item Criar um portfólio empresarial do seletor", async () => {
    const scope = fakeScope([
      { role: "button", name: "Criar um portfólio empresarial" },
      { role: "link", name: "Criar portfólio empresarial" },
      { role: "button", name: "Criar" },
    ]);
    expect(await clickSwitcherCreate(scope)).toBe("Criar um portfólio empresarial");
    expect(scope.clicks).toEqual(["Criar um portfólio empresarial"]);
  });
});
