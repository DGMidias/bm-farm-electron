import type { EmpresaCard } from "./empresa";

const SMALL = new Set(["a", "as", "o", "os", "de", "da", "do", "das", "dos", "del", "e", "em"]);

export function titleName(value: string): string {
  return value
    .trim()
    .split(/(\s+)/)
    .reduce((parts, token) => {
      if (/^\s+$/.test(token)) return [...parts, token];
      const word = token
        .split(/([,./-])/)
        .map((piece) => {
          if (!piece || /[,./-]/.test(piece) || /^\d/.test(piece)) return piece;
          const lower = piece.toLocaleLowerCase("pt-BR");
          const wordIndex = parts.filter((item) => !/^\s+$/.test(item)).length;
          if (wordIndex > 0 && SMALL.has(lower)) return lower;
          return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
        })
        .join("");
      return [...parts, word];
    }, [] as string[])
    .join("");
}

export function formatEmpresaFields<T extends Partial<EmpresaCard>>(fields: T): T {
  const next = { ...fields };
  if (next.razao_social) next.razao_social = titleName(next.razao_social);
  if (next.responsavel) next.responsavel = titleName(next.responsavel);
  if (next.email_comercial) next.email_comercial = next.email_comercial.trim().toLocaleLowerCase("pt-BR");
  if (next.endereco) next.endereco = titleName(next.endereco);
  if (next.complemento) next.complemento = titleName(next.complemento);
  if (next.cidade) next.cidade = titleName(next.cidade);
  if (next.estado) next.estado = next.estado.trim().toLocaleUpperCase("pt-BR");
  if (next.site) next.site = next.site.trim();
  return next;
}
