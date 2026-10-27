import { BrowserWindow } from "electron";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inflateRawSync, inflateSync } from "node:zlib";
import { mergeCnpjFields, parseCnpjComprovante, parseCnpjFromOcr } from "@shared/cnpj-pdf";
import { extractPdfText } from "@shared/pdf-text";
import type { EmpresaCard } from "@shared/empresa";
import { log, logError } from "./log";

export interface EmpresaDocumentResult {
  path: string;
  fields: Partial<EmpresaCard>;
}

function extractEmbeddedText(buffer: Buffer): string {
  const chunks: string[] = [];
  const parts = buffer.toString("latin1").split(/stream\r?\n/);
  for (const part of parts.slice(1)) {
    const end = part.indexOf("endstream");
    if (end < 0) continue;
    const raw = Buffer.from(part.slice(0, end).replace(/^\r?\n/, "").replace(/\r?\n$/, ""), "latin1");
    for (const inflate of [inflateSync, inflateRawSync]) {
      try {
        const decoded = inflate(raw).toString("utf8");
        if (/nome empresarial|n[uú]mero de inscri|cnpj/i.test(decoded)) chunks.push(decoded);
        break;
      } catch {
        continue;
      }
    }
  }
  return chunks.join("\n");
}

async function ocrPdf(filePath: string): Promise<{ text: string; words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> {
  const window = new BrowserWindow({
    show: false,
    width: 1400,
    height: 2000,
    webPreferences: { sandbox: true },
  });
  try {
    await window.loadURL(pathToFileURL(filePath).href);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await window.webContents.setZoomFactor(0.55);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const png = (await window.webContents.capturePage()).toPNG();
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("por");
    try {
      const result = await worker.recognize(png);
      const words = (result.data.words ?? []).map((item) => ({
        text: item.text,
        bbox: item.bbox,
      }));
      return { text: result.data.text, words };
    } finally {
      await worker.terminate();
    }
  } finally {
    window.destroy();
  }
}

export async function readEmpresaDocument(filePath: string, autoFill: boolean): Promise<EmpresaDocumentResult> {
  if (!filePath.trim()) throw new Error("PDF não selecionado.");
  if (!autoFill) return { path: filePath, fields: {} };
  try {
    const buffer = readFileSync(filePath);
    const embedded = [extractPdfText(buffer), extractEmbeddedText(buffer)].filter(Boolean).join("\n");
    const fromText = parseCnpjComprovante(embedded);
    if (fromText.cnpj && fromText.razao_social) return { path: filePath, fields: fromText };
    log("info", "empresa", "PDF sem texto embutido; lendo o comprovante por OCR.");
    const ocr = await ocrPdf(filePath);
    return { path: filePath, fields: mergeCnpjFields(parseCnpjComprovante(ocr.text), parseCnpjFromOcr(ocr.words)) };
  } catch (error) {
    logError("empresa", error, "leitura do comprovante CNPJ");
    return { path: filePath, fields: {} };
  }
}
