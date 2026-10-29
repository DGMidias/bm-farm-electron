import { emptyEmpresa } from "@shared/empresa";
import {
  EMPRESA_COUNTRY,
  clickSaveEmpresa,
  currentSettingsPortfolio,
  empresaSaveFailed,
  empresaSaveSucceeded,
  empresaDetailsEmpty,
  empresaDetailsFormVisible,
  empresaEtapaConcluida,
  empresaPageMatchesCard,
  fillEmpresaDetails,
  isEmpresaDetailsForm,
  openEmpresaDetailsModal,
  selectEmpresaCountry,
  type EmpresaFillScope,
} from "@shared/empresa-fill";
import { farmLocatorTexts, PROFILE_SPECIFIC_FORBIDDEN } from "@shared/portfolio-fill";
import { describe, expect, it } from "vitest";

function fakeScope(items: Array<string | { role: string; name: string }>): EmpresaFillScope & {
  filled: Record<string, string>;
  clicks: string[];
} {
  const filled: Record<string, string> = {};
  const clicks: string[] = [];
  const names = items.map((item) => (typeof item === "string" ? item : item.name));
  const present = (role: string | undefined, name: string) =>
    items.some((item) => {
      if (typeof item === "string") return item === name;
      return item.name === name && (!role || item.role === role);
    });
  return {
    filled,
    clicks,
    getByLabel: (name: string) => ({
      count: async () => (names.includes(name) ? 1 : 0),
      fill: async (value: string) => {
        filled[name] = value;
      },
    }),
    getByPlaceholder: (name: string) => ({
      count: async () => (names.includes(name) ? 1 : 0),
      fill: async (value: string) => {
        filled[name] = value;
      },
    }),
    getByRole: (role: string, options?: { name?: string | RegExp; exact?: boolean }) => {
      const name = options?.name;
      const label = name === undefined ? "" : String(name);
      return {
        count: async () => {
          if (name === undefined) return items.filter((item) => typeof item !== "string" && item.role === role).length;
          return present(role, label) ? 1 : 0;
        },
        first: () => ({
          click: async () => {
            clicks.push(label || role);
          },
        }),
      };
    },
    getByText: (name: string | RegExp, options?: { exact?: boolean }) => {
      const label = typeof name === "string" ? name : name.source;
      const hit = typeof name === "string" ? names.includes(name) : names.some((item) => name.test(item));
      return {
        count: async () => (hit ? 1 : 0),
        first: () => ({
          click: async () => {
            clicks.push(label);
          },
        }),
        locator: () => ({
          count: async () => (hit ? 1 : 0),
          first: () => ({
            click: async () => {
              clicks.push(`editar:${label}`);
            },
          }),
        }),
      };
    },
  };
}

const EMPTY_PAGE = [
  "Informações do portfólio empresarial",
  "Editar",
  "Detalhes da empresa",
  "Editar",
  "Razão social da empresa",
  "Sem nome",
  "Endereço",
  "Sem endereço",
  "Telefone comercial",
  "Sem telefone",
  "Site",
  "Site indisponível",
];

describe("preenchimento dos detalhes da empresa", () => {
  it("reconhece a página vazia, o modal e não pula etapa incompleta", () => {
    expect(empresaDetailsEmpty(EMPTY_PAGE)).toBe(true);
    expect(
      empresaEtapaConcluida({
        texts: EMPTY_PAGE,
        razaoSocial: "Vesol Energia Solar Ltda",
        endereco: "R Jose Theodoro Ribeiro, 2723",
      }),
    ).toBe(false);
    expect(isEmpresaDetailsForm(EMPTY_PAGE)).toBe(false);
    expect(
      isEmpresaDetailsForm([
        "Editar detalhes da empresa",
        "Razão social da empresa",
        "País",
        "Identificação fiscal (EIN)",
        "Salvar",
      ]),
    ).toBe(true);
    expect(
      isEmpresaDetailsForm([
        "Insira o nome comercial conforme mostrado em documentos oficiais",
        "Insira a razão social da empresa.",
        "País",
        "Salvar",
      ]),
    ).toBe(true);
    expect(EMPRESA_COUNTRY).toEqual(["Brasil", "Brazil"]);
  });

  it("o recorte de 80 linhas atrás do modal não esconde o diálogo se o locator do campo existir", async () => {
    const closed = fakeScope(["Razão social da empresa", { role: "button", name: "Editar" }]);
    expect(await empresaDetailsFormVisible(closed)).toBe(false);
    const open = fakeScope(["Razão social da empresa", "País", "Insira o nome comercial conforme mostrado em documentos oficiais"]);
    expect(await empresaDetailsFormVisible(open)).toBe(true);
    expect(currentSettingsPortfolio(["Pba Contabilidade Ltda", "Identificação do portfólio empresarial: 1629787285455853"])).toBe(
      "Pba Contabilidade Ltda",
    );
    expect(
      empresaPageMatchesCard(
        ["Pba Contabilidade Ltda", "Identificação do portfólio empresarial: 1629787285455853"],
        "Vesol Energia Solar Ltda",
      ),
    ).toBe(false);
    expect(
      empresaPageMatchesCard(
        ["Vesol Energia Solar Ltda", "Identificação do portfólio empresarial: 1618424756678450"],
        "Vesol Energia Solar Ltda",
      ),
    ).toBe(true);
    expect(isEmpresaDetailsForm(["Editar detalhes da empresa", "Insira a razão social da empresa."])).toBe(true);
  });

  it("pula só se razão e endereço já estão nos detalhes, sem placeholder vazio", () => {
    const filled = [
      "Vesol Energia Solar Ltda",
      "Identificação do portfólio empresarial: 1618424756678450",
      "Detalhes da empresa",
      "Razão social da empresa",
      "Vesol Energia Solar Ltda",
      "Endereço",
      "R Jose Theodoro Ribeiro, 2723",
      "Telefone comercial",
      "(47) 3204-3799",
    ];
    expect(empresaDetailsEmpty(filled)).toBe(false);
    expect(
      empresaEtapaConcluida({
        texts: filled,
        razaoSocial: "Vesol Energia Solar Ltda",
        endereco: "R Jose Theodoro Ribeiro, 2723",
      }),
    ).toBe(true);
    expect(
      empresaEtapaConcluida({
        texts: [
          "Vesol Energia Solar Ltda",
          "Identificação do portfólio empresarial: 16184247566784500",
          "Detalhes da empresa",
          "Razão social da empresa",
          "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
          "Endereço",
          "R Carderoverde, 24550",
        ],
        razaoSocial: "Solfacil Energia Solar Tecnologia e Servicos Financeiros Ltda",
        endereco: "R Carderoverde, 24550",
      }),
    ).toBe(false);
  });

  it("abre o Editar da seção Detalhes da empresa, preenche e salva com país Brasil", async () => {
    const card = emptyEmpresa("e1");
    card.razao_social = "Vesol Energia Solar Ltda";
    card.endereco = "R Jose Theodoro Ribeiro, 2723";
    card.complemento = "Ilha da Figueira";
    card.cidade = "Jaragua do Sul";
    card.estado = "SC";
    card.cep = "89258001";
    card.telefone = "4732043799";
    card.site = "https://www.vesol.com.br";
    card.cnpj = "51.449.498/0001-05";
    const page = fakeScope([
      { role: "heading", name: "Detalhes da empresa" },
      { role: "button", name: "Editar" },
    ]);
    expect(await openEmpresaDetailsModal(page)).toBe("Editar");
    const modal = fakeScope([
      "Razão social da empresa",
      "País",
      "Endereço",
      "Endereço (continuação)",
      "Cidade",
      "Estado/província/região",
      "CEP/código postal",
      "Telefone comercial",
      "Site da empresa",
      "Identificação fiscal (EIN)",
      { role: "combobox", name: "País" },
      { role: "option", name: "Brasil" },
      { role: "button", name: "Salvar" },
    ]);
    const filled = await fillEmpresaDetails(modal, card);
    expect(filled.filled).toBeGreaterThanOrEqual(6);
    expect(modal.filled["Razão social da empresa"]).toBe("Vesol Energia Solar Ltda");
    expect(modal.filled["Endereço (continuação)"]).toBe("Ilha da Figueira");
    expect(modal.filled["Identificação fiscal (EIN)"]).toBe("51.449.498/0001-05");
    expect(await selectEmpresaCountry(modal)).toBe("Brasil");
    expect(await clickSaveEmpresa(modal)).toBe("Salvar");
    expect(modal.clicks).toContain("Brasil");
    expect(modal.clicks).toContain("Salvar");
    expect(farmLocatorTexts().join("\n")).not.toMatch(PROFILE_SPECIFIC_FORBIDDEN);
  });

  it("preenche pelo placeholder quando o rótulo acessível não está no input", async () => {
    const card = emptyEmpresa("e1");
    card.razao_social = "Vesol Energia Solar Ltda";
    card.endereco = "R Jose Theodoro Ribeiro, 2723";
    const modal = fakeScope([
      "Insira o nome comercial conforme mostrado em documentos oficiais",
      "Endereço",
    ]);
    const filled = await fillEmpresaDetails(modal, card);
    expect(filled.keys).toContain("razao_social");
    expect(modal.filled["Insira o nome comercial conforme mostrado em documentos oficiais"]).toBe(
      "Vesol Energia Solar Ltda",
    );
    expect(modal.filled.Endereço).toBe("R Jose Theodoro Ribeiro, 2723");
  });

  it("seleciona Brasil no combobox País, nunca um select aleatório", async () => {
    const dialog = fakeScope([{ role: "combobox", name: "Ninguém" }]);
    const page = fakeScope([{ role: "option", name: "Brasil" }]);
    expect(await selectEmpresaCountry(dialog, page)).toBeUndefined();
    expect(page.clicks).not.toContain("Brasil");
    const pais = fakeScope([{ role: "combobox", name: "País" }]);
    const lista = fakeScope([{ role: "option", name: "Brasil" }]);
    expect(await selectEmpresaCountry(pais, lista)).toBe("Brasil");
    expect(lista.clicks).toContain("Brasil");
    expect(
      empresaSaveFailed(["Não foi possível salvar as alterações. Tente novamente."]),
    ).toBe(true);
    expect(empresaSaveFailed(["Erro ao realizar a consulta."])).toBe(true);
    expect(empresaSaveFailed(["Editar detalhes da empresa", "Salvar"])).toBe(false);
    expect(empresaSaveSucceeded(["Alterações salvas"])).toBe(true);
    expect(
      empresaEtapaConcluida({
        texts: [
          "Vesol Energia Solar Ltda",
          "Identificação do portfólio empresarial: 1618424756678450",
          "Editar detalhes da empresa",
          "Vesol Energia Solar Ltda",
          "R Jose Theodoro Ribeiro, 2723",
          "Alterações salvas",
        ],
        razaoSocial: "Vesol Energia Solar Ltda",
        endereco: "R Jose Theodoro Ribeiro, 2723",
      }),
    ).toBe(true);
  });

  it("filtra Brasil na busca do select — a lista virtualizada só mostra o A", async () => {
    const dialog = fakeScope([{ role: "combobox", name: "País" }]);
    const page = fakeScope([{ role: "option", name: "Brasil" }]);
    let query = "";
    page.fillSearch = async (value) => {
      query = value;
    };
    expect(await selectEmpresaCountry(dialog, page)).toBe("Brasil");
    expect(query).toBe("Brasil");
    expect(page.clicks).toContain("Brasil");
  });
});
