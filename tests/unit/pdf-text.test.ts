import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractPdfText } from "@shared/pdf-text";
import { parseCnpjComprovante } from "@shared/cnpj-pdf";
import { describe, expect, it } from "vitest";

const documentos = resolve(process.cwd(), "..", "farming-automatico", "documentos");

describe("texto do comprovante CNPJ impresso pelo Chrome", () => {
  it.skipIf(!existsSync(resolve(documentos, "download.pdf")))("lê o cartão da VESOL sem OCR", () => {
    const text = extractPdfText(readFileSync(resolve(documentos, "download.pdf")));
    const fields = parseCnpjComprovante(text);
    expect(text).toMatch(/NOME EMPRESARIAL/);
    expect(fields.razao_social).toBe("Vesol Energia Solar Ltda");
    expect(fields.cnpj).toBe("51.449.498/0001-05");
    expect(fields.endereco).toBe("R Jose Theodoro Ribeiro, 2723");
    expect(fields.complemento).toBe("Ilha da Figueira");
    expect(fields.cidade).toBe("Jaragua do Sul");
    expect(fields.estado).toBe("SC");
  });

  it.skipIf(!existsSync(resolve(documentos, "download-forallz.pdf")))("lê o cartão da Forallz sem OCR", () => {
    const text = extractPdfText(readFileSync(resolve(documentos, "download-forallz.pdf")));
    const fields = parseCnpjComprovante(text);
    expect(fields.razao_social).toBe("Felipi Estevao Matos da Trindade 08777435680");
    expect(fields.cnpj).toBe("46.971.233/0001-32");
    expect(fields.endereco).toBe("Av Leite de Castro, 1679");
    expect(fields.complemento).toBe("Fabricas");
    expect(fields.cidade).toBe("Sao Joao del Rei");
    expect(fields.estado).toBe("MG");
  });
});
