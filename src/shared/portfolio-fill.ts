import { empresaLocatorTexts } from "./empresa-fill";
import {
  ADS_POLICY_ACCEPT,
  ADS_POLICY_DONE,
  CONTINUE_SESSION_TRIGGERS,
  CREATE_BUTTON_NAMES,
  LANDING_TRIGGERS,
  PORTFOLIO_FIELDS,
  PORTFOLIO_ONBOARDING_FIELDS,
} from "./farm-etapas";

export interface Fillable {
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
}

export interface Clickable {
  count: () => Promise<number>;
  first: () => { click: (options?: { timeout?: number; force?: boolean }) => Promise<void> };
}

export interface PortfolioScope {
  getByLabel: (name: string, options?: { exact?: boolean }) => Fillable;
  getByPlaceholder: (name: string, options?: { exact?: boolean }) => Fillable;
  getByRole: (role: string, options?: { name?: string | RegExp; exact?: boolean }) => Clickable;
}

export const SWITCHER_SECTION_START = [/portfólios empresariais/i, /business portfolios/i];
export const SWITCHER_SECTION_END = [
  /^(páginas|pages)$/i,
  /^(contas do instagram|instagram accounts)$/i,
  /^(criar um portfólio empresarial|create a business portfolio)$/i,
];
export const SWITCHER_CREATE_TRIGGERS = [
  { role: "button", names: ["Criar um portfólio empresarial", "Create a business portfolio"] },
  { role: "menuitem", names: ["Criar um portfólio empresarial", "Create a business portfolio"] },
];

/** Chip do seletor: chrome "portfólio empresarial" ou o nome do BM aberto. Nunca 2FA/País. */
export const SWITCHER_OPEN = { role: "combobox" as const };
export const SWITCHER_COMBO_NAME =
  /portfólio empresarial|business portfolio|^(?!(ninguém|nobody|país|country|somente administradores|todos)\b).+/i;

export type PostCreateStep = "add_assets" | "add_people" | "confirm";

export const POST_CREATE_NEXT = ["Avançar", "Continue", "Next"] as const;
export const POST_CREATE_CONFIRM = ["Confirmar", "Confirm"] as const;

export const ADD_ASSETS_HEADING = [
  /o que você quer adicionar a este portfólio/i,
  /what do you want to add to this (business )?portfolio/i,
];
export const ADD_PEOPLE_HEADING = [
  /adicione pessoas a este portfólio/i,
  /add people to this (business )?portfolio/i,
];
export const CONFIRM_PORTFOLIO_HEADING = [
  /analise e confirme seu portfólio/i,
  /review and confirm your (business )?portfolio/i,
];

export const FACEBOOK_NAME_CHROME =
  /conheça|meta business suite|business suite|portfólio empresarial|adicionar a este|reivindic|etapas para começar|gerenciador|criar post|crie post|criar anúncio|criar reel/i;

export const PROFILE_SPECIFIC_FORBIDDEN = /bmnovaativa|vesol|debra r\.?\s*rocha|emerson market/i;

export function farmLocatorTexts(): string[] {
  return [
    ...PORTFOLIO_FIELDS.flatMap((field) => field.labels),
    ...PORTFOLIO_ONBOARDING_FIELDS.flatMap((field) => field.labels),
    ...CREATE_BUTTON_NAMES,
    ...LANDING_TRIGGERS.flatMap((trigger) => trigger.names),
    ...SWITCHER_CREATE_TRIGGERS.flatMap((trigger) => trigger.names),
    ...POST_CREATE_NEXT,
    ...POST_CREATE_CONFIRM,
    ...CONTINUE_SESSION_TRIGGERS.flatMap((trigger) => trigger.names),
    ...ADS_POLICY_ACCEPT,
    ...ADS_POLICY_DONE,
    SWITCHER_OPEN.role,
    SWITCHER_COMBO_NAME.source,
    ...empresaLocatorTexts(),
  ];
}

export function postCreateStep(texts: string[]): PostCreateStep | undefined {
  const blob = texts.join(" ");
  if (CONFIRM_PORTFOLIO_HEADING.some((pattern) => pattern.test(blob))) return "confirm";
  if (ADD_PEOPLE_HEADING.some((pattern) => pattern.test(blob))) return "add_people";
  if (ADD_ASSETS_HEADING.some((pattern) => pattern.test(blob))) return "add_assets";
  return undefined;
}

export function postCreateButtonNames(step: PostCreateStep): readonly string[] {
  return step === "confirm" ? POST_CREATE_CONFIRM : POST_CREATE_NEXT;
}

export function isAddAssetsDialog(texts: string[]): boolean {
  return postCreateStep(texts) === "add_assets";
}

export function isPortfolioCreateForm(texts: string[]): boolean {
  const blob = texts.join(" ");
  return /nome do portfólio empresarial|nome da sua conta e empresa|crie seu portfólio empresarial|your business and account name|business portfolio name/i.test(
    blob,
  );
}

export function isLoginChooser(texts: string[]): boolean {
  if (isPortfolioCreateForm(texts)) return false;
  const blob = texts.join(" ");
  return /continuar com o facebook|continue with facebook/i.test(blob);
}

/** O overlay de criar fica no fim do DOM; o snapshot de 80 linhas só vê o chooser atrás. */
export function shouldClickContinueSession(input: { texts: string[]; formOpen?: boolean }): boolean {
  if (input.formOpen) return false;
  return isLoginChooser(input.texts);
}

export function isAdsPolicyDialog(texts: string[]): boolean {
  if (isPortfolioCreateForm(texts)) return false;
  const blob = texts.join(" ");
  return (
    /política de não discriminação|non-discrimination policy/i.test(blob) &&
    /ao clicar em aceito|by clicking (i accept|accept)|você confirma que|you confirm that/i.test(blob)
  );
}

export function isAdsPolicyThanks(texts: string[]): boolean {
  const blob = texts.join(" ");
  return /agradecemos a sua aceitação|thank you for (accepting|your acceptance)/i.test(blob);
}

export function adsPolicyButtonNames(texts: string[]): readonly string[] | undefined {
  if (isAdsPolicyThanks(texts)) return ADS_POLICY_DONE;
  if (isAdsPolicyDialog(texts)) return ADS_POLICY_ACCEPT;
  return undefined;
}

export async function clickAdsPolicy(
  scope: Pick<PortfolioScope, "getByRole">,
  texts: string[],
): Promise<string | undefined> {
  const names = adsPolicyButtonNames(texts);
  if (!names) return undefined;
  return clickNamedButtons(scope, names);
}

export function splitFacebookName(full: string): { nome: string; sobrenome: string } | undefined {
  const trimmed = full.trim();
  if (FACEBOOK_NAME_CHROME.test(trimmed)) return undefined;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return undefined;
  return { nome: tokens[0]!, sobrenome: tokens[tokens.length - 1]! };
}

export function extractBusinessPortfolioNames(texts: string[]): string[] {
  const names: string[] = [];
  let inSection = false;
  for (const raw of texts) {
    const line = raw.trim();
    if (!line) continue;
    if (SWITCHER_SECTION_START.some((pattern) => pattern.test(line))) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (SWITCHER_SECTION_END.some((pattern) => pattern.test(line))) break;
    if (/^(pesquisar|search|ver tudo|see all)$/i.test(line)) continue;
    if (/^\d+\s+ativos? de negócios$/i.test(line)) continue;
    if (/^\d+\s+business assets?$/i.test(line)) continue;
    if (line.length > 80) continue;
    names.push(line);
  }
  return names;
}

async function fillFieldSet(
  scope: Pick<PortfolioScope, "getByLabel" | "getByPlaceholder">,
  fields: Array<{ key: string; labels: readonly string[] }>,
  values: Record<string, string>,
): Promise<{ filled: number; keys: string[] }> {
  const keys: string[] = [];
  for (const field of fields) {
    const value = String(values[field.key] ?? "").trim();
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

export async function fillPortfolioFields(
  scope: Pick<PortfolioScope, "getByLabel" | "getByPlaceholder">,
  values: Record<string, string>,
): Promise<{ filled: number; keys: string[]; variant: "switcher" | "onboarding" }> {
  const switcher = await fillFieldSet(scope, PORTFOLIO_FIELDS, values);
  if (switcher.filled > 0) return { ...switcher, variant: "switcher" };
  const responsavel = values.responsavel?.trim() || [values.nome, values.sobrenome].filter(Boolean).join(" ");
  const onboarding = await fillFieldSet(scope, PORTFOLIO_ONBOARDING_FIELDS, { ...values, responsavel });
  return { ...onboarding, variant: "onboarding" };
}

export async function clickCreateButton(scope: Pick<PortfolioScope, "getByRole">): Promise<string | undefined> {
  for (const name of CREATE_BUTTON_NAMES) {
    const button = scope.getByRole("button", { name, exact: true });
    if ((await button.count()) > 0) {
      await button.first().click({ timeout: 4000 });
      return name;
    }
  }
  return undefined;
}

export async function openPortfolioModal(scope: Pick<PortfolioScope, "getByRole">): Promise<string | undefined> {
  for (const trigger of LANDING_TRIGGERS) {
    for (const name of trigger.names) {
      const target = scope.getByRole(trigger.role, { name, exact: true });
      if ((await target.count()) === 0) continue;
      try {
        await target.first().click({ timeout: 4000 });
        return name;
      } catch {
        try {
          await target.first().click({ timeout: 4000, force: true });
          return name;
        } catch {
          continue;
        }
      }
    }
  }
  return undefined;
}

export async function openSwitcher(scope: Pick<PortfolioScope, "getByRole">): Promise<boolean> {
  const chip = scope.getByRole(SWITCHER_OPEN.role, { name: SWITCHER_COMBO_NAME });
  if ((await chip.count()) === 0) return false;
  try {
    await chip.first().click({ timeout: 4000 });
    return true;
  } catch {
    try {
      await chip.first().click({ timeout: 4000, force: true });
      return true;
    } catch {
      return false;
    }
  }
}

export async function clickNamedButtons(
  scope: Pick<PortfolioScope, "getByRole">,
  names: readonly string[],
): Promise<string | undefined> {
  for (const name of names) {
    const target = scope.getByRole("button", { name, exact: true });
    if ((await target.count()) === 0) continue;
    try {
      await target.first().click({ timeout: 4000 });
      return name;
    } catch {
      try {
        await target.first().click({ timeout: 4000, force: true });
        return name;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function clickPostCreateStep(
  scope: Pick<PortfolioScope, "getByRole">,
  step: PostCreateStep,
): Promise<string | undefined> {
  return clickNamedButtons(scope, postCreateButtonNames(step));
}

export async function clickContinueSession(scope: Pick<PortfolioScope, "getByRole">): Promise<string | undefined> {
  for (const trigger of CONTINUE_SESSION_TRIGGERS) {
    const clicked = await clickNamedButtons(scope, trigger.names);
    if (clicked) return clicked;
  }
  return undefined;
}

export async function clickSwitcherCreate(scope: Pick<PortfolioScope, "getByRole">): Promise<string | undefined> {
  for (const trigger of SWITCHER_CREATE_TRIGGERS) {
    for (const name of trigger.names) {
      const target = scope.getByRole(trigger.role, { name, exact: true });
      if ((await target.count()) > 0) {
        await target.first().click({ timeout: 4000 });
        return name;
      }
    }
  }
  return undefined;
}

export function portfolioLooksCreated(
  url: string,
  options: { dialogOpen?: boolean; submitted?: boolean } = {},
): boolean {
  if (!options.submitted) return false;
  if (/[?&]business_id=/i.test(url)) return true;
  if (/adsmanager\/manage|business\.facebook\.com\/latest/i.test(url) && !options.dialogOpen) return true;
  return false;
}
