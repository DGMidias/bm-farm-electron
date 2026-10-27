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
}

export function emptyEmpresa(id = crypto.randomUUID()): EmpresaCard {
  return {
    id,
    razao_social: "",
    cnpj: "",
    responsavel: "",
    email_comercial: "",
    usar_email_temporario: false,
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

export function validateEmpresa(card: EmpresaCard): string[] {
  const errors: string[] = [];
  const required: Array<keyof EmpresaCard> = [
    "razao_social",
    "cnpj",
    "responsavel",
    "endereco",
    "cidade",
    "estado",
    "cep",
    "telefone",
    "site",
    "adspower_profile",
  ];
  for (const key of required) {
    if (!String(card[key] ?? "").trim()) errors.push(`Campo obrigatório: ${key}`);
  }
  if (card.email_comercial && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email_comercial)) {
    errors.push("E-mail comercial inválido.");
  }
  if (!card.usar_email_temporario && !card.email_comercial.trim()) {
    errors.push("Informe o e-mail comercial ou marque o temporário só na validação.");
  }
  if (card.cnpj && !validCnpj(card.cnpj)) errors.push("CNPJ inválido.");
  if (card.estado && !/^[A-Za-z]{2}$/.test(card.estado)) errors.push("UF deve ter 2 letras.");
  if (card.cep && digits(card.cep).length !== 8) errors.push("CEP deve ter 8 dígitos.");
  if (card.telefone && ![10, 11].includes(digits(card.telefone).length)) {
    errors.push("Telefone deve ter DDD e número, sem +55.");
  }
  try {
    const url = new URL(card.site);
    if (url.protocol !== "https:") errors.push("Site deve ser HTTPS.");
  } catch {
    if (card.site.trim()) errors.push("Site inválido.");
  }
  return errors;
}

export const FIELDS_FOR = {
  portfolio: [
    ["Nome da sua conta e empresa", "razao_social"],
    ["Seu nome", "responsavel"],
    ["Seu email comercial", "email_comercial"],
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
