import { formatEmpresaFields } from "./empresa-format";
import { digits, validCnpj, type EmpresaCard } from "./empresa";

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

const UF = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function compact(value: string): string {
  return fold(value).replace(/[^a-z0-9@.]/g, "");
}

export function formatCnpj(value: string): string {
  const n = digits(value).slice(0, 14);
  if (n.length !== 14) return value.trim();
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function cnpjMasks(text: string): string[] {
  return [...text.matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)].map((item) => item[0]);
}

export function extractValidCnpj(text: string): string | undefined {
  const afterInscricao = afterFuzzy(text, ["numero de inscricao"], ["matriz", "filial", "comprovante", "data de"]);
  for (const item of [...cnpjMasks(afterInscricao), ...cnpjMasks(text)]) {
    if (validCnpj(item)) return formatCnpj(item);
  }
  return undefined;
}

function firstMatch(text: string, pattern: RegExp): string {
  return pattern.exec(text)?.[1] ?? pattern.exec(text)?.[0] ?? "";
}

function cutAtStops(source: string, stops: string[]): { value: string; end: number; hit?: string } {
  const folded = fold(source);
  let end = source.length;
  let hit: string | undefined;
  for (const stop of stops) {
    const at = folded.indexOf(fold(stop));
    if (at >= 0 && at < end) {
      end = at;
      hit = stop;
    }
  }
  return { value: source.slice(0, end).replace(/\s+/g, " ").trim(), end, hit };
}

function afterFuzzy(text: string, labels: string[], stops: string[]): string {
  const folded = fold(text);
  let start = -1;
  let labelLength = 0;
  for (const label of labels) {
    const needle = fold(label);
    const at = folded.indexOf(needle);
    if (at >= 0 && (start < 0 || at < start || (at === start && needle.length > labelLength))) {
      start = at;
      labelLength = needle.length;
    }
  }
  if (start < 0) return "";
  let rest = text.slice(start + labelLength).replace(/^[:\s\-–|/]+/, "");
  const first = cutAtStops(rest, stops);
  if (first.value) return first.value;
  if (first.hit && first.end < 12) {
    rest = rest.slice(first.end + fold(first.hit).length).replace(/^[:\s\-–|/]+/, "");
    return cutAtStops(rest, stops).value;
  }
  return "";
}

function siteFromEmail(email: string): string | undefined {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || /^(gmail|hotmail|outlook|yahoo|live|icloud|uol)\./.test(domain)) return undefined;
  return `https://www.${domain}`;
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[:\-–|]+/, "").trim();
}

function visibleValue(value: string): string {
  const clean = cleanLine(value);
  if (!clean || /^\*+$/.test(clean)) return "";
  return clean;
}

function streetNumber(value: string): string {
  const withoutCnpj = value.replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, " ");
  const labeled = /n[uú]mero(?!\s+de\s+inscri)[:\s|]*(\d{1,5})\b/i.exec(withoutCnpj);
  if (labeled?.[1]) return labeled[1];
  const trailing = withoutCnpj.match(/\b(\d{2,5})\b/g);
  return trailing?.at(-1) ?? "";
}

function joinAddress(street: string, number: string): string {
  const stripped = cleanLine(street.replace(/n[uú]mero(?!\s+de\s+inscri).*$/i, "").replace(/,?\s*\d{1,5}\s*$/, ""));
  const n = streetNumber(number) || number.replace(/\D/g, "");
  const safe = n.length >= 1 && n.length <= 5 ? n : streetNumber(street);
  if (stripped && safe) return `${stripped}, ${safe}`;
  return stripped || safe;
}

export function parseCnpjComprovante(text: string): Partial<EmpresaCard> {
  const blob = text.replace(/\s+/g, " ").trim();
  const cnpj = extractValidCnpj(text);
  const email = firstMatch(blob, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const telefone =
    firstMatch(afterFuzzy(text, ["telefone"], ["ente federativo", "situacao", "qr"]) || blob, /(\(\d{2}\)\s*\d{4,5}-?\d{4})/) ||
    firstMatch(blob, /(\(\d{2}\)\s*\d{4,5}-?\d{4})/);
  const cep = firstMatch(blob, /(\d{2}\.\d{3}-\d{3})/) || afterFuzzy(text, ["cep"], ["bairro", "municipio", "uf"]);
  const razao = afterFuzzy(text, ["nome empresarial", "nowe empresarial"], [
    "data de constituicao",
    "titulo do estabelecimento",
    "nome de fantasia",
    "porte",
    "codigo",
    "logradouro",
  ]);
  const logradouro = afterFuzzy(text, ["logradouro", "togradouro"], ["numero", "complemento", "cep"]);
  const numero = streetNumber(afterFuzzy(text, ["logradouro", "togradouro"], ["cep", "bairro", "endereco eletr"]));
  const complemento = afterFuzzy(text, ["complemento"], ["cep", "bairro"]);
  const cidade = afterFuzzy(text, ["municipio", "moncifio"], ["uf", "endereco eletr", "telefone"]);
  let estado = afterFuzzy(text, ["uf"], ["endereco eletr", "telefone"]).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  if (!UF.test(estado)) estado = firstMatch(blob, UF);
  const endereco = joinAddress(logradouro, numero);
  const fields: Partial<EmpresaCard> = {};
  if (razao) fields.razao_social = cleanLine(razao);
  if (cnpj) fields.cnpj = cnpj;
  if (endereco) fields.endereco = endereco;
  const complementoLimpo = visibleValue(complemento);
  if (complementoLimpo && !/^(cep\b|\d{2}\.?\d{3}-?\d{3}$)/i.test(complementoLimpo)) {
    fields.complemento = complementoLimpo;
  }
  if (cidade) fields.cidade = cleanLine(cidade.replace(UF, "").trim());
  if (estado) fields.estado = estado;
  if (cep) fields.cep = cep;
  if (telefone) fields.telefone = telefone;
  if (email) fields.email_comercial = email;
  const site = email ? siteFromEmail(email) : undefined;
  if (site) fields.site = site;
  return formatEmpresaFields(fields);
}

function lineKey(word: OcrWord): number {
  return Math.round(word.bbox.y0 / 8);
}

function lineText(words: OcrWord[]): string {
  return words.map((item) => item.text).join(" ");
}

function matchesLabel(word: string, labels: string[]): boolean {
  const compactWord = compact(word);
  if (!compactWord) return false;
  return labels.some((label) => {
    const compactLabel = compact(label);
    if (compactWord === compactLabel) return true;
    if (compactWord.length >= 4 && compactLabel.includes(compactWord)) return true;
    if (compactLabel.length >= 4 && compactWord.includes(compactLabel)) return true;
    return false;
  });
}

function cellBelow(words: OcrWord[], labels: string[]): OcrWord[] {
  const labelWords = words.filter((item) => matchesLabel(item.text, labels));
  if (!labelWords.length) return [];
  const top = Math.min(...labelWords.map((item) => item.bbox.y1));
  const labelRight = Math.max(...labelWords.map((item) => item.bbox.x1));
  const sameRow = words.filter((item) => Math.abs(item.bbox.y0 - labelWords[0].bbox.y0) < 14);
  let left = Math.min(...labelWords.map((item) => item.bbox.x0));
  for (const item of sameRow.filter((word) => word.bbox.x1 <= left + 8).sort((a, b) => b.bbox.x0 - a.bbox.x0)) {
    if (left - item.bbox.x1 >= 24) break;
    left = Math.min(left, item.bbox.x0);
  }
  left -= 8;
  const neighbor = words
    .filter((item) => Math.abs(item.bbox.y0 - labelWords[0].bbox.y0) < 14 && item.bbox.x0 > labelRight + 8)
    .sort((a, b) => a.bbox.x0 - b.bbox.x0)[0];
  const right = neighbor ? neighbor.bbox.x0 - 4 : labelRight + 180;
  return words
    .filter((item) => item.bbox.y0 > top - 2 && item.bbox.y0 < top + 36 && item.bbox.x0 >= left && item.bbox.x0 <= right)
    .sort((a, b) => a.bbox.x0 - b.bbox.x0);
}

export function parseCnpjFromOcr(words: OcrWord[]): Partial<EmpresaCard> {
  const lines = new Map<number, OcrWord[]>();
  for (const word of words) {
    const key = lineKey(word);
    lines.set(key, [...(lines.get(key) ?? []), word]);
  }
  const ordered = [...lines.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => a.bbox.x0 - b.bbox.x0));
  const text = ordered.map(lineText).join("\n");
  const fields = parseCnpjComprovante(text);
  const razao = lineText(cellBelow(words, ["empresarial"]));
  const logradouro = lineText(cellBelow(words, ["logradouro", "togradouro"]));
  const numero = lineText(cellBelow(words, ["numero"])).replace(/[^\d]/g, "");
  const cep = lineText(cellBelow(words, ["cep"]));
  const complemento = visibleValue(lineText(cellBelow(words, ["complemento"])));
  const cidade = lineText(cellBelow(words, ["municipio"]));
  const estado = lineText(cellBelow(words, ["uf"]));
  const email = lineText(cellBelow(words, ["eletronico", "eletrônico"]));
  const telefone = lineText(cellBelow(words, ["telefone"]));
  if (razao) fields.razao_social = cleanLine(razao);
  if (logradouro || numero) fields.endereco = joinAddress(logradouro, numero);
  if (complemento) fields.complemento = complemento;
  if (cidade) fields.cidade = cleanLine(cidade.replace(UF, "").trim());
  if (UF.test(estado)) fields.estado = estado.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  if (/\d{2}\.\d{3}-\d{3}/.test(cep)) fields.cep = firstMatch(cep, /(\d{2}\.\d{3}-\d{3})/);
  if (email.includes("@")) fields.email_comercial = firstMatch(email, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (telefone) fields.telefone = firstMatch(telefone, /(\(\d{2}\)\s*\d{4,5}-?\d{4})/) || fields.telefone;
  const cnpj = extractValidCnpj(words.map((item) => item.text).join(" "));
  if (cnpj) fields.cnpj = cnpj;
  if (fields.email_comercial && !fields.site) {
    const site = siteFromEmail(fields.email_comercial);
    if (site) fields.site = site;
  }
  return formatEmpresaFields(fields);
}

export function mergeCnpjFields(...parts: Array<Partial<EmpresaCard>>): Partial<EmpresaCard> {
  const merged: Partial<EmpresaCard> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (typeof value === "string" && value.trim()) {
        (merged as Record<string, string>)[key] = value.trim();
      }
    }
  }
  return formatEmpresaFields(merged);
}

export function adsProfileOption(profile: { userId: string; serial?: string; name?: string }): { value: string; label: string } {
  const value = profile.serial || profile.userId;
  const name = profile.name || profile.userId;
  return { value, label: profile.serial ? `${profile.serial} · ${name}` : name };
}
