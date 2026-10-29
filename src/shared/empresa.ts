export interface EmpresaCard {
  id: string;
  razao_social: string;
  cnpj: string;
  responsavel: string;
  email_comercial: string;
  usar_email_temporario: boolean;
  endereco: string;
  complemento: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  site: string;
  documento_original: string;
  autorizado_pela_empresa: boolean;
  documento_sem_alteracao_de_conteudo: boolean;
  adspower_profile: string;
  ler_pdf_automatico: boolean;
  business_id?: string;
}

function normalizeEmpresaRazao(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sameEmpresaIdentity(
  left: Pick<EmpresaCard, "razao_social" | "cnpj">,
  right: Pick<EmpresaCard, "razao_social" | "cnpj">,
): boolean {
  return normalizeEmpresaRazao(left.razao_social) === normalizeEmpresaRazao(right.razao_social) && digits(left.cnpj) === digits(right.cnpj);
}

export function withEmpresaBusinessId(empresas: EmpresaCard[], cardId: string, businessId: string): EmpresaCard[] {
  const id = businessId.trim();
  return empresas.map((item) => {
    if (item.id !== cardId) return item;
    if (!id) {
      const { business_id: _dropped, ...rest } = item;
      return rest;
    }
    return { ...item, business_id: id };
  });
}

export function mergeEmpresaBusinessIds(disk: EmpresaCard[] | undefined, incoming: EmpresaCard[] | undefined): EmpresaCard[] {
  const fromDisk = new Map((disk ?? []).map((item) => [item.id, item]));
  return (incoming ?? disk ?? []).map((card) => {
    const previous = fromDisk.get(card.id);
    const incomingId = card.business_id?.trim();
    const diskId = previous?.business_id?.trim();
    if (previous && !sameEmpresaIdentity(card, previous)) {
      const { business_id: _dropped, ...rest } = card;
      return rest;
    }
    const stored = incomingId || diskId;
    return stored ? { ...card, business_id: stored } : card;
  });
}

export function emptyEmpresa(id: string = crypto.randomUUID()): EmpresaCard {
  return {
    id,
    razao_social: "",
    cnpj: "",
    responsavel: "",
    email_comercial: "",
    usar_email_temporario: true,
    endereco: "",
    complemento: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    site: "https://",
    documento_original: "",
    autorizado_pela_empresa: false,
    documento_sem_alteracao_de_conteudo: false,
    adspower_profile: "",
    ler_pdf_automatico: true,
  };
}

export function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function validCnpj(value: string): boolean {
  const n = digits(value);
  if (n.length !== 14 || new Set(n).size === 1) return false;
  let base = n.slice(0, 12);
  for (const weights of [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  ]) {
    const rest = weights.reduce((sum, weight, index) => sum + Number(base[index]) * weight, 0) % 11;
    base += rest < 2 ? "0" : String(11 - rest);
  }
  return base === n;
}

function siteReady(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export type EmpresaFieldErrors = Partial<Record<keyof EmpresaCard, string>>;

export function empresaFieldErrors(card: EmpresaCard): EmpresaFieldErrors {
  const errors: EmpresaFieldErrors = {};
  const required: Array<keyof EmpresaCard> = [
    "razao_social",
    "cnpj",
    "endereco",
    "cidade",
    "estado",
    "cep",
    "site",
    "adspower_profile",
    "documento_original",
  ];
  for (const key of required) {
    if (!String(card[key] ?? "").trim()) errors[key] = "Obrigatório.";
  }
  if (card.email_comercial.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email_comercial)) {
    errors.email_comercial = "E-mail comercial inválido.";
  }
  if (card.cnpj.trim() && !validCnpj(card.cnpj)) errors.cnpj = "CNPJ inválido.";
  if (card.estado.trim() && !/^[A-Za-z]{2}$/.test(card.estado)) errors.estado = "UF deve ter 2 letras.";
  if (card.cep.trim() && digits(card.cep).length !== 8) errors.cep = "CEP deve ter 8 dígitos.";
  if (card.telefone.trim() && ![10, 11].includes(digits(card.telefone).length)) {
    errors.telefone = "Telefone deve ter DDD e número, sem +55.";
  }
  if (card.site.trim() && !siteReady(card.site)) errors.site = "Site deve ser HTTPS com domínio, não só https://.";
  if (!card.autorizado_pela_empresa) errors.autorizado_pela_empresa = "Marque que está autorizado pela empresa.";
  if (!card.documento_sem_alteracao_de_conteudo) {
    errors.documento_sem_alteracao_de_conteudo = "Marque que o documento é original sem alteração.";
  }
  return errors;
}

export function validateEmpresa(card: EmpresaCard): string[] {
  return Object.values(empresaFieldErrors(card));
}

export function farmFieldErrors(cards: EmpresaCard[], knownProfiles: string[] = []): Record<string, EmpresaFieldErrors> {
  const byId: Record<string, EmpresaFieldErrors> = {};
  for (const card of cards) byId[card.id] = empresaFieldErrors(card);
  const profiles = new Map<string, string[]>();
  const cnpjs = new Map<string, string[]>();
  const known = new Set(knownProfiles.filter(Boolean));
  for (const card of cards) {
    const profile = card.adspower_profile.trim();
    if (profile) {
      const list = profiles.get(profile) ?? [];
      list.push(card.id);
      profiles.set(profile, list);
      if (known.size && !known.has(profile)) {
        byId[card.id].adspower_profile = "Perfil AdsPower não está na listagem local.";
      }
    }
    const cnpj = digits(card.cnpj);
    if (cnpj) {
      const list = cnpjs.get(cnpj) ?? [];
      list.push(card.id);
      cnpjs.set(cnpj, list);
    }
  }
  for (const [profile, ids] of profiles) {
    if (ids.length < 2) continue;
    for (const id of ids) byId[id].adspower_profile = `Perfil AdsPower ${profile} está em mais de um card.`;
  }
  for (const ids of cnpjs.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) byId[id].cnpj = "CNPJ está em mais de um card.";
  }
  return byId;
}

export function validateFarmStart(cards: EmpresaCard[], knownProfiles: string[] = []): string[] {
  if (!cards.length) return ["Adicione pelo menos uma empresa."];
  const errors: string[] = [];
  const byId = farmFieldErrors(cards, knownProfiles);
  for (const card of cards) {
    for (const error of Object.values(byId[card.id] ?? {})) {
      errors.push(`${card.razao_social || card.id}: ${error}`);
    }
  }
  return [...new Set(errors)];
}

export const FIELDS_FOR = {
  portfolio: [
    ["Nome do portfólio empresarial", "razao_social"],
    ["Nome", "responsavel"],
    ["Sobrenome", "responsavel"],
    ["Email comercial", "email_comercial"],
  ],
  empresa: [
    ["Razão social da empresa", "razao_social"],
    ["Endereço", "endereco"],
    ["Endereço (continuação)", "complemento"],
    ["Cidade", "cidade"],
    ["Estado/província/região", "estado"],
    ["CEP/código postal", "cep"],
    ["Telefone comercial", "telefone"],
    ["Site da empresa", "site"],
    ["Identificação fiscal (EIN)", "cnpj"],
  ],
  whatsapp: [
    ["Nome de exibição do WhatsApp Business", "razao_social"],
    ["Site", "site"],
  ],
  verificacao_dados: [
    ["Identificação Fiscal da Empresa/Número de Registro da Empresa", "cnpj"],
    ["Nome da empresa", "razao_social"],
  ],
  verificacao_nome: [["Nome comercial registrado", "razao_social"]],
  verificacao_endereco: [
    ["Endereço", "endereco"],
    ["Complemento (opcional)", "complemento"],
    ["Cidade", "cidade"],
    ["Estado/província/região", "estado"],
    ["Código postal", "cep"],
  ],
  verificacao_contato: [
    ["Telefone", "telefone"],
    ["Site", "site"],
  ],
} as const;
