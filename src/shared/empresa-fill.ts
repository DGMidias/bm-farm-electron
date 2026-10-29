import type { EmpresaCard } from "./empresa";
import { formatBrMobilePhone } from "./empresa-format";
import { empresaPageMatchesCard, normalizePortfolioName } from "./farm-etapas";

export { currentSettingsPortfolio, empresaPageMatchesCard } from "./farm-etapas";

export interface Fillable {
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
}

export interface Clickable {
  count: () => Promise<number>;
  first: () => { click: (options?: { timeout?: number; force?: boolean }) => Promise<void> };
}

export interface EmpresaFillScope {
  getByLabel: (name: string, options?: { exact?: boolean }) => Fillable;
  getByPlaceholder: (name: string, options?: { exact?: boolean }) => Fillable;
  getByRole: (role: string, options?: { name?: string | RegExp; exact?: boolean }) => Clickable;
  fillSearch?: (value: string) => Promise<void>;
}

export const EMPRESA_COUNTRY = ["Brasil", "Brazil"] as const;
export const EMPRESA_COUNTRY_LABELS = ["País", "Country"];
export const EMPRESA_SAVE = ["Salvar", "Save"] as const;
export const EMPRESA_EDIT = ["Editar", "Edit"] as const;
export const EMPRESA_DETAILS_SECTION = ["Detalhes da empresa", "Business details"] as const;

export const EMPRESA_DETAIL_FIELDS = [
  {
    key: "razao_social" as const,
    labels: [
      "Razão social da empresa",
      "Legal business name",
      "Insira o nome comercial conforme mostrado em documentos oficiais",
      "Insira a razão social da empresa.",
    ],
  },
  { key: "endereco" as const, labels: ["Endereço", "Address"] },
  { key: "complemento" as const, labels: ["Endereço (continuação)", "Address line 2"] },
  { key: "cidade" as const, labels: ["Cidade", "City"] },
  { key: "estado" as const, labels: ["Estado/província/região", "State/province/region"] },
  { key: "cep" as const, labels: ["CEP/código postal", "ZIP/postal code"] },
  { key: "telefone" as const, labels: ["Telefone comercial", "Business phone"] },
  { key: "site" as const, labels: ["Site da empresa", "Business website"] },
  { key: "cnpj" as const, labels: ["Identificação fiscal (EIN)", "Tax ID (EIN)"] },
];

const EMPTY_DETAILS = /sem nome|no name|sem endereço|no address|sem telefone|no phone|site indisponível|website unavailable/i;

export function empresaLocatorTexts(): string[] {
  return [
    ...EMPRESA_DETAIL_FIELDS.flatMap((field) => field.labels),
    ...EMPRESA_COUNTRY,
    ...EMPRESA_COUNTRY_LABELS,
    ...EMPRESA_SAVE,
    ...EMPRESA_EDIT,
    ...EMPRESA_DETAILS_SECTION,
    "Editar detalhes da empresa",
    "Edit business details",
  ];
}

export function empresaDetailsEmpty(texts: string[]): boolean {
  return EMPTY_DETAILS.test(texts.join(" "));
}

const MODAL_LINE =
  /editar detalhes da empresa|edit (business|company) details|insira a razão social|insira o nome comercial|identificação fiscal \(ein\)|tax id \(ein\)|selecione um país/i;

export function isEmpresaDetailsForm(texts: string[]): boolean {
  return texts.some((line) => MODAL_LINE.test(line.trim()));
}

export const EMPRESA_FORM_LABELS = ["País", "Country", "Identificação fiscal (EIN)", "Tax ID (EIN)"];
export const EMPRESA_FORM_PLACEHOLDERS = [
  "Insira o nome comercial conforme mostrado em documentos oficiais",
  "Insira a razão social da empresa.",
];

export async function empresaDetailsFormVisible(
  scope: Pick<EmpresaFillScope, "getByLabel" | "getByPlaceholder">,
): Promise<boolean> {
  for (const label of EMPRESA_FORM_LABELS) {
    if ((await scope.getByLabel(label, { exact: true }).count()) >= 1) return true;
  }
  for (const placeholder of EMPRESA_FORM_PLACEHOLDERS) {
    if ((await scope.getByPlaceholder(placeholder, { exact: true }).count()) >= 1) return true;
  }
  return false;
}

export function empresaEtapaConcluida(input: {
  texts: string[];
  razaoSocial: string;
  endereco?: string;
}): boolean {
  if (empresaDetailsEmpty(input.texts)) return false;
  if (!empresaPageMatchesCard(input.texts, input.razaoSocial)) return false;
  const blob = normalizePortfolioName(input.texts.join(" "));
  const razao = normalizePortfolioName(input.razaoSocial);
  if (!razao || !blob.includes(razao)) return false;
  const endereco = normalizePortfolioName(input.endereco ?? "");
  if (endereco && !blob.includes(endereco)) return false;
  return true;
}

function fieldValue(key: keyof EmpresaCard, card: EmpresaCard): string {
  const value = String(card[key] ?? "").trim();
  if (key === "site" && /^https?:\/\/$/i.test(value)) return "";
  if (key === "telefone") return formatBrMobilePhone(value);
  return value;
}

export async function fillEmpresaDetails(
  scope: Pick<EmpresaFillScope, "getByLabel" | "getByPlaceholder">,
  card: EmpresaCard,
): Promise<{ filled: number; keys: string[] }> {
  const keys: string[] = [];
  for (const field of EMPRESA_DETAIL_FIELDS) {
    const value = fieldValue(field.key, card);
    if (!value) continue;
    for (const label of field.labels) {
      const labeled = scope.getByLabel(label, { exact: true });
      if ((await labeled.count()) === 1) {
        await labeled.fill(value);
        keys.push(field.key);
        break;
      }
      const placeholder = scope.getByPlaceholder(label, { exact: true });
      if ((await placeholder.count()) === 1) {
        await placeholder.fill(value);
        keys.push(field.key);
        break;
      }
    }
  }
  return { filled: keys.length, keys };
}

export function empresaSaveFailed(texts: string[]): boolean {
  return texts.some((line) =>
    /não foi possível salvar|couldn't save|unable to save|tente novamente|erro ao realizar a consulta|error (performing|running) (the )?(query|search)/i.test(
      line,
    ),
  );
}

export function empresaSaveSucceeded(texts: string[]): boolean {
  return texts.some((line) => /alterações salvas|changes saved|saved successfully/i.test(line));
}

async function clickFirst(target: Clickable): Promise<boolean> {
  if ((await target.count()) === 0) return false;
  try {
    await target.first().click({ timeout: 4000 });
    return true;
  } catch {
    await target.first().click({ timeout: 4000, force: true }).catch(() => undefined);
    return true;
  }
}

export async function selectEmpresaCountry(
  comboScope: Pick<EmpresaFillScope, "getByRole">,
  optionScope?: Pick<EmpresaFillScope, "getByRole">,
): Promise<string | undefined> {
  const lists = optionScope ?? comboScope;
  let opened = false;
  for (const label of EMPRESA_COUNTRY_LABELS) {
    if (await clickFirst(comboScope.getByRole("combobox", { name: label }))) {
      opened = true;
      break;
    }
  }
  if (!opened && optionScope && (await clickFirst(optionScope.getByRole("combobox", { name: /país|country/i })))) {
    opened = true;
  }
  if (!opened) return undefined;
  const searcher = optionScope ?? comboScope;
  if (searcher.fillSearch) await searcher.fillSearch(EMPRESA_COUNTRY[0]);
  for (const name of EMPRESA_COUNTRY) {
    if (await clickFirst(lists.getByRole("option", { name }))) return name;
    if (optionScope && optionScope !== lists && (await clickFirst(optionScope.getByRole("option", { name })))) {
      return name;
    }
  }
  return undefined;
}

export async function openEmpresaDetailsModal(scope: Pick<EmpresaFillScope, "getByRole">): Promise<string | undefined> {
  for (const name of EMPRESA_EDIT) {
    const button = scope.getByRole("button", { name, exact: true });
    if ((await button.count()) === 0) continue;
    try {
      await button.first().click({ timeout: 4000 });
      return name;
    } catch {
      try {
        await button.first().click({ timeout: 4000, force: true });
        return name;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

export async function clickSaveEmpresa(scope: Pick<EmpresaFillScope, "getByRole">): Promise<string | undefined> {
  for (const name of EMPRESA_SAVE) {
    const button = scope.getByRole("button", { name, exact: true });
    if ((await button.count()) === 0) continue;
    try {
      await button.first().click({ timeout: 4000 });
      return name;
    } catch {
      try {
        await button.first().click({ timeout: 4000, force: true });
        return name;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
