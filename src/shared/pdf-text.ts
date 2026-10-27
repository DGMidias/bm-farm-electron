import { inflateRawSync, inflateSync } from "node:zlib";

function inflateBytes(bytes: Buffer): Buffer | undefined {
  for (const inflate of [inflateSync, inflateRawSync]) {
    try {
      return inflate(bytes);
    } catch {
      continue;
    }
  }
  return undefined;
}

function parseObjects(latin: string): Map<number, string> {
  const objects = new Map<number, string>();
  const found = latin.matchAll(/(\d+)\s+0\s+obj/g);
  for (const match of found) {
    const id = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = latin.indexOf("endobj", start);
    if (end < 0) continue;
    objects.set(id, latin.slice(start, end));
  }
  return objects;
}

function streamOf(body: string): string | undefined {
  const at = body.indexOf("stream");
  if (at < 0) return undefined;
  let raw = body.slice(at + 6);
  const end = raw.lastIndexOf("endstream");
  if (end >= 0) raw = raw.slice(0, end);
  if (raw.startsWith("\r\n")) raw = raw.slice(2);
  else if (raw.startsWith("\n") || raw.startsWith("\r")) raw = raw.slice(1);
  if (raw.endsWith("\r\n")) raw = raw.slice(0, -2);
  else if (raw.endsWith("\n") || raw.endsWith("\r")) raw = raw.slice(0, -1);
  return inflateBytes(Buffer.from(raw, "latin1"))?.toString("latin1");
}

export function parseToUnicodeCmap(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of cmap.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const row of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(Number.parseInt(row[1], 16), String.fromCharCode(Number.parseInt(row[2], 16)));
    }
  }
  for (const block of cmap.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const row of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const from = Number.parseInt(row[1], 16);
      const to = Number.parseInt(row[2], 16);
      let dest = Number.parseInt(row[3], 16);
      for (let cid = from; cid <= to; cid += 1, dest += 1) {
        map.set(cid, String.fromCharCode(dest));
      }
    }
  }
  return map;
}

export function decodeCidHex(hex: string, cmap: Map<number, string>): string {
  const chars: string[] = [];
  for (let index = 0; index < hex.length; index += 4) {
    const cid = Number.parseInt(hex.slice(index, index + 4), 16);
    chars.push(cmap.get(cid) ?? "");
  }
  return chars.join("");
}

export function extractPdfText(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const objects = parseObjects(latin);
  const fonts = new Map<number, Map<number, string>>();
  for (const [id, body] of objects) {
    const toUnicode = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(body);
    if (!toUnicode) continue;
    const cmapBody = objects.get(Number(toUnicode[1]));
    fonts.set(id, parseToUnicodeCmap(streamOf(cmapBody ?? "") ?? ""));
  }
  const pageFonts = new Map<string, Map<number, string>>();
  for (const body of objects.values()) {
    const dict = /\/Font\s*<<([^>]+)>>/.exec(body);
    if (!dict) continue;
    for (const item of dict[1].matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
      pageFonts.set(item[1], fonts.get(Number(item[2])) ?? new Map());
    }
  }
  const lines: string[] = [];
  for (const body of objects.values()) {
    const contents = streamOf(body);
    if (!contents || !/<[0-9A-Fa-f]+>\s*Tj/.test(contents)) continue;
    let current = new Map<number, string>();
    let line = "";
    const flush = () => {
      const trimmed = line.replace(/\s+/g, " ").trim();
      if (trimmed) lines.push(trimmed);
      line = "";
    };
    for (const token of contents.matchAll(/\/(F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\bET\b/g)) {
      if (token[0] === "ET" || token[1]) {
        flush();
        if (token[1]) current = pageFonts.get(token[1]) ?? current;
        continue;
      }
      line += decodeCidHex(token[2], current);
    }
    flush();
  }
  return lines.join("\n");
}
