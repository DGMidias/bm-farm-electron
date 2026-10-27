export const KEEP_ADSPOWER_OPEN_ON_END = true;

export function businessIdFromUrl(url: string): string | undefined {
  const match = url.match(/[?&]business_id=([^&#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function arrivedAtExistingPortfolio(url: string): boolean {
  if (/\/latest\/settings\//i.test(url)) return false;
  return /\/latest\/home/i.test(url) || /nav_ref=bm_home_redirect/i.test(url);
}

export function shouldLogDetach(profile: string | undefined, alreadyDetached: boolean): boolean {
  return Boolean(profile?.trim()) && !alreadyDetached;
}

export function formatNotLoggedInLog(profile: string): string {
  const id = profile.trim() || "?";
  return `Perfil ${id} não está logado na Meta · faça login no AdsPower e clique em Continuar.`;
}

export function formatFarmDetachLog(profile: string): string {
  const id = profile.trim() || "?";
  return `CDP solto · perfil ${id} e as abas ficam abertos para conferência.`;
}

export function formatPortfolioFilledLog(input: {
  razaoSocial: string;
  responsavel: string;
  email: string;
  keys: string[];
}): string {
  return `Preenchendo portfólio · ${input.keys.length} campos · ${input.razaoSocial} · ${input.responsavel} · ${input.email}`;
}

export function formatPortfolioCreatedLog(input: {
  razaoSocial: string;
  responsavel: string;
  email: string;
  url: string;
}): string {
  const businessId = businessIdFromUrl(input.url);
  const idPart = businessId ? `business_id=${businessId}` : "sem business_id";
  return `Portfólio criado · ${input.razaoSocial} · ${input.responsavel} · ${input.email} · ${idPart} · ${input.url}`;
}

export function formatPortfolioRedirectLog(input: { cta: string; pageName?: string; url: string }): string {
  const businessId = businessIdFromUrl(input.url);
  const name = input.pageName?.trim() || "sem nome na página";
  const idPart = businessId ? `business_id=${businessId}` : "sem business_id";
  return `Landing redirecionou sem formulário · cliquei ${input.cta} · página ${name} · ${idPart} · ${input.url}`;
}

export function formatSuiteUnavailableRedirectLog(input: { businessId: string; url: string }): string {
  return `Suite indisponível · business_id=${input.businessId} · abrindo pessoas do portfólio · ${input.url}`;
}

export function formatExistingBmLog(input: { pageName?: string; url: string }): string {
  const businessId = businessIdFromUrl(input.url);
  const name = input.pageName?.trim() || "sem nome na página";
  const idPart = businessId ? `business_id=${businessId}` : "sem business_id";
  return `Este perfil já tem o portfólio ${name} · ${idPart} · ${input.url}`;
}

export function formatEtapaSkippedLog(input: {
  etapa: string;
  pageName?: string;
  url?: string;
  listed?: boolean;
}): string {
  const name = input.pageName?.trim() || "sem nome na página";
  if (input.listed) {
    return `Etapa ${input.etapa} já concluída · pulando · ${name} · listada no seletor`;
  }
  const businessId = input.url ? businessIdFromUrl(input.url) : undefined;
  const idPart = businessId ? `business_id=${businessId}` : "sem business_id";
  return `Etapa ${input.etapa} já concluída · pulando · ${name} · ${idPart}${input.url ? ` · ${input.url}` : ""}`;
}

export function formatTempEmailLog(input: { address: string; razaoSocial: string; profile: string }): string {
  const short = input.razaoSocial.trim().split(/\s+/)[0] || input.razaoSocial;
  return `E-mail temporário · ${input.address} · ${short} · perfil ${input.profile}`;
}
