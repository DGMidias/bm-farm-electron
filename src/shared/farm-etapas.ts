import { businessIdFromUrl } from "./farm-log";

export type FarmEtapaId =
  | "portfolio"
  | "empresa"
  | "email_confirm"
  | "whatsapp"
  | "verificacao_dados"
  | "verificacao_documento"
  | "verificacao_sms"
  | "verificacao_nome"
  | "verificacao_endereco"
  | "verificacao_contato";

export type FarmEtapaStatus = "ready" | "pending";

export interface FarmEtapa {
  id: FarmEtapaId;
  titulo: string;
  resumo: string;
  status: FarmEtapaStatus;
  url?: string;
}

export const PORTFOLIO_URL = "https://adsmanager.facebook.com/adsmanager/onboarding?nav_source=fb4b";

export const BUSINESS_USERS_SETTINGS_PATH = "/latest/settings/business_users/";

export const SUITE_UNAVAILABLE_TEXT = [
  /não é possível acessar o meta business suite/i,
  /you can.?t access meta business suite/i,
  /não tem acesso a páginas do facebook/i,
  /doesn.?t have access to facebook pages/i,
];

export const PORTFOLIO_FIELDS = [
  { key: "razao_social" as const, labels: ["Nome do portfólio empresarial", "Business portfolio name"] },
  { key: "nome" as const, labels: ["Nome", "First name"] },
  { key: "sobrenome" as const, labels: ["Sobrenome", "Last name"] },
  { key: "email_comercial" as const, labels: ["Email comercial", "Business email"] },
];

/** Modal do Gerenciador (landing): 3 campos + Enviar. */
export const PORTFOLIO_ONBOARDING_FIELDS = [
  { key: "razao_social" as const, labels: ["Nome da sua conta e empresa", "Your business and account name"] },
  { key: "responsavel" as const, labels: ["Seu nome", "Your name"] },
  { key: "email_comercial" as const, labels: ["Seu email comercial", "Business email"] },
];

export const CREATE_BUTTON_NAMES = ["Enviar", "Submit", "Criar", "Create"];

export const CONTINUE_SESSION_TRIGGERS = [
  { role: "button", names: ["Continuar com o Facebook", "Continue with Facebook"] },
];

export const LANDING_TRIGGERS = [
  { role: "link", names: ["Criar portfólio empresarial", "Create a business portfolio"] },
  { role: "button", names: ["Começar", "Get started"] },
];

/** Diálogo de política de anúncios no onboarding (perfil novo). Papel button, sem nome de empresa. */
export const ADS_POLICY_ACCEPT = ["Aceito", "I Accept"] as const;
export const ADS_POLICY_DONE = ["Concluir", "Done", "Finish"] as const;

export const FARM_ETAPAS: FarmEtapa[] = [
  {
    id: "portfolio",
    titulo: "Portfólio empresarial",
    resumo: "Cria o portfólio pelo seletor: razão, nome/sobrenome do Facebook e e-mail temporário.",
    status: "ready",
    url: PORTFOLIO_URL,
  },
  {
    id: "empresa",
    titulo: "Informações da empresa",
    resumo: "Endereço, número virtual, site e CNPJ como identificação fiscal.",
    status: "ready",
    url: "https://business.facebook.com/latest/settings/business_info",
  },
  {
    id: "email_confirm",
    titulo: "Confirmar e-mail",
    resumo: "Lê o link na caixa Gmail/Outlook/Hotmail da empresa e confirma no Chromium do AdsPower.",
    status: "ready",
  },
  {
    id: "whatsapp",
    titulo: "WhatsApp Business",
    resumo: "Nome de exibição e site da conta WhatsApp.",
    status: "pending",
    url: "https://business.facebook.com/latest/settings/whatsapp_account",
  },
  {
    id: "verificacao_dados",
    titulo: "Verificação: dados",
    resumo: "Identificação fiscal e razão social na Central de Segurança.",
    status: "pending",
    url: "https://business.facebook.com/latest/settings/security_center",
  },
  {
    id: "verificacao_documento",
    titulo: "Verificação: documento",
    resumo: "Upload do comprovante CNPJ.",
    status: "pending",
  },
  {
    id: "verificacao_sms",
    titulo: "Verificação: SMS",
    resumo: "OTP. Pausa humana.",
    status: "pending",
  },
  {
    id: "verificacao_nome",
    titulo: "Verificação: nome",
    resumo: "Nome comercial registrado.",
    status: "pending",
  },
  {
    id: "verificacao_endereco",
    titulo: "Verificação: endereço",
    resumo: "Endereço, cidade, UF e CEP.",
    status: "pending",
  },
  {
    id: "verificacao_contato",
    titulo: "Verificação: contato",
    resumo: "Telefone e site.",
    status: "pending",
  },
];

/** Etapa já feita no perfil: logar e pular. Sem recriar, sem pausar como erro. */
export const SKIP_COMPLETED_ETAPA = true;

/** Etapa 3: espera o e-mail da Meta na mesma caixa, sem gerar outra. */
export const EMAIL_CONFIRM_EMPTY_POLLS = 20;
export const EMAIL_CONFIRM_POLL_MS = 5000;

/** Etapa 1 sempre mina caixa 22.do nova. Nunca o e-mail do PDF/CNPJ — a verificação da Meta cai nessa caixa. */
export function shouldGeneratePortfolioInbox(_card?: {
  email_comercial?: string;
  usar_email_temporario?: boolean;
}): boolean {
  return true;
}

/** Etapa 2 sempre gera número virtual novo. Nunca o telefone do PDF/CNPJ. */
export function shouldGenerateEmpresaPhone(_card?: { telefone?: string }): boolean {
  return true;
}

export function normalizePortfolioName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function stripPortfolioListNoise(value: string): string {
  return normalizePortfolioName(value)
    .replace(/\s+\d+\s+ativos? de negócios.*$/i, "")
    .replace(/\s+\d+\s+business assets?.*$/i, "")
    .trim();
}

export function portfolioListed(nomesDoSeletor: string[], razaoSocial: string): boolean {
  const target = normalizePortfolioName(razaoSocial);
  if (!target) return false;
  return nomesDoSeletor.some((name) => {
    const clean = stripPortfolioListNoise(name);
    return clean === target || clean.startsWith(`${target} `);
  });
}

export function isSuiteUnavailable(texts: string[]): boolean {
  const blob = texts.join(" ");
  return SUITE_UNAVAILABLE_TEXT.some((pattern) => pattern.test(blob));
}

export function businessUsersSettingsUrl(businessId: string): string {
  const id = encodeURIComponent(businessId.trim());
  return `https://business.facebook.com${BUSINESS_USERS_SETTINGS_PATH}?nav_ref=bm_settings_redirect_migration&bm_redirect_migration=true&business_id=${id}`;
}

export function shouldRedirectToBusinessUsers(input: { url: string; texts: string[] }): string | undefined {
  if (/\/latest\/settings\/business_users/i.test(input.url)) return undefined;
  if (!isSuiteUnavailable(input.texts)) return undefined;
  const id = businessIdFromUrl(input.url);
  if (!id) return undefined;
  return businessUsersSettingsUrl(id);
}

export function withBusinessId(url: string, businessId: string): string {
  const id = businessId.trim();
  if (!id) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("business_id", id);
  return parsed.toString();
}

export function etapaHref(etapa: Pick<FarmEtapa, "url">, businessId?: string): string | undefined {
  if (!etapa.url) return undefined;
  if (!businessId?.trim()) return etapa.url;
  return withBusinessId(etapa.url, businessId);
}

/** Id persistido no card ganha da sessão — outro BM no perfil não pode vazar. */
export function businessIdForEmpresa(input: { sessionId?: string; storedId?: string }): string | undefined {
  const stored = input.storedId?.trim();
  if (stored) return stored;
  const session = input.sessionId?.trim();
  return session || undefined;
}

export function currentSettingsPortfolio(texts: string[]): string | undefined {
  const index = texts.findIndex((line) => /identificação do portfólio empresarial|business portfolio id/i.test(line));
  if (index <= 0) return undefined;
  const name = texts[index - 1]?.trim();
  if (!name || /^(editar|edit|informações do portfólio|business portfolio info)/i.test(name)) return undefined;
  return name;
}

export function empresaPageMatchesCard(texts: string[], razaoSocial: string): boolean {
  const current = currentSettingsPortfolio(texts);
  if (!current) return false;
  return portfolioListed([current], razaoSocial);
}

export function portfolioIsCurrent(input: {
  url: string;
  texts?: string[];
  razaoSocial?: string;
  storedId?: string;
}): boolean {
  if (input.texts?.length && input.razaoSocial) {
    if (currentSettingsPortfolio(input.texts)) {
      return empresaPageMatchesCard(input.texts, input.razaoSocial);
    }
    return portfolioListed(input.texts, input.razaoSocial);
  }
  const urlId = businessIdFromUrl(input.url);
  const stored = input.storedId?.trim();
  if (urlId && stored && urlId === stored) return true;
  return false;
}

export type PortfolioListedAction = "skip" | "goto" | "pause" | "create";

export function portfolioListedAction(input: {
  listed: boolean;
  current: boolean;
  storedId?: string;
}): PortfolioListedAction {
  if (!input.listed) return "create";
  if (input.current) return "skip";
  if (input.storedId?.trim()) return "goto";
  return "pause";
}

/** Só pula se o chrome já é o BM do card. storedId sozinho não navega — o seletor confirma a razão. */
export function portfolioResumeAction(input: {
  current: boolean;
  storedId?: string;
  chromeMismatch?: boolean;
}): "skip" | "goto" | undefined {
  if (input.chromeMismatch) return undefined;
  if (input.current) return "skip";
  return undefined;
}

export function empresaChromeBlocksEdit(texts: string[], razaoSocial: string): boolean {
  if (!currentSettingsPortfolio(texts)) return false;
  return !empresaPageMatchesCard(texts, razaoSocial);
}

export function isDuplicatePortfolioError(texts: string[]): boolean {
  const blob = texts.join(" ");
  return (
    /escolha outro nome para seu portfólio/i.test(blob) ||
    /mesmo nome de um à qual você já tem acesso/i.test(blob) ||
    /choose a different (name|portfolio)/i.test(blob) ||
    /already have access/i.test(blob)
  );
}

export function portfolioEtapaConcluida(input: {
  screenId?: string;
  url: string;
  listedNames?: string[];
  razaoSocial?: string;
  texts?: string[];
  storedId?: string;
}): boolean {
  if (!input.razaoSocial || !input.listedNames) return false;
  if (!portfolioListed(input.listedNames, input.razaoSocial)) return false;
  return portfolioIsCurrent({
    url: input.url,
    texts: input.texts,
    razaoSocial: input.razaoSocial,
    storedId: input.storedId,
  });
}

/** Heading/toolbar entram no chrome — innerText da settings recém-aberta costuma vir vazio. */
export function mergePortfolioChrome(texts: string[], extra: string[] = []): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...texts, ...extra]) {
    for (const part of raw.split(/\n+/)) {
      const line = part.trim();
      if (!line) continue;
      const key = normalizePortfolioName(line);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
  }
  return lines;
}

/** Depois de Confirmar, a Meta já está no /latest/ — não abre o seletor. */
export function portfolioNeedsSwitcher(input: { submitted: boolean; confirmed: boolean; url: string }): boolean {
  if (input.confirmed) return false;
  if (input.submitted && /\/latest\//i.test(input.url) && businessIdFromUrl(input.url)) return false;
  return true;
}

/** Depois de criar, /latest/ com business_id e a razão no chrome fecham a etapa 1 sem o seletor. */
export function portfolioConfirmedOnSettings(input: {
  url: string;
  texts: string[];
  razaoSocial: string;
  submitted?: boolean;
}): boolean {
  if (!input.submitted) return false;
  if (!businessIdFromUrl(input.url)) return false;
  if (!/\/latest\//i.test(input.url)) return false;
  return portfolioListed(input.texts, input.razaoSocial);
}

export function executableEtapas(): FarmEtapa[] {
  return FARM_ETAPAS.filter((item) => item.status === "ready");
}

export function clampBatchSize(size: number, total: number): number {
  const max = Math.max(1, total);
  if (!Number.isFinite(size)) return 1;
  return Math.min(max, Math.max(1, Math.floor(size)));
}
