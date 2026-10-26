import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { joinPath, spawnInstaller, type LatestJson } from "@harness/compat";
import type { UpdateCheckResult } from "@shared/types";
import { evaluateUpdate, verifySha512 } from "@shared/update";

export async function fetchLatest(latestUrl: string): Promise<LatestJson> {
  if (!latestUrl.trim()) throw new Error("URL de latest.json vazia.");
  const response = await fetch(latestUrl);
  if (!response.ok) throw new Error(`latest.json HTTP ${response.status}`);
  return (await response.json()) as LatestJson;
}

export async function checkUpdate(current: string, latestUrl: string, platform = process.platform): Promise<UpdateCheckResult> {
  if (!latestUrl.trim()) {
    return {
      current,
      newer: false,
      mensagem: "Configure a URL do latest.json para verificar atualizações.",
    };
  }
  try {
    const latest = await fetchLatest(latestUrl);
    const result = evaluateUpdate(current, latest, platform);
    return {
      current,
      remote: latest.version,
      newer: result.newer,
      notes: latest.notes,
      artifactUrl: result.artifactUrl,
      mensagem: result.reason,
    };
  } catch (error) {
    return {
      current,
      newer: false,
      mensagem: error instanceof Error ? error.message : "Falha ao checar atualização.",
    };
  }
}

export async function downloadAndInstall(
  artifactUrl: string,
  sha512: string,
  downloadDir: string,
  platform = process.platform,
): Promise<string> {
  const response = await fetch(artifactUrl);
  if (!response.ok || !response.body) throw new Error("Falha no download da atualização.");
  const fileName = artifactUrl.split("/").pop() || "update.bin";
  const target = joinPath(downloadDir, fileName);
  const hash = createHash("sha512");
  const nodeStream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  nodeStream.on("data", (chunk: Buffer) => hash.update(chunk));
  await pipeline(nodeStream, createWriteStream(target));
  if (!verifySha512(hash.digest("hex"), sha512)) {
    throw new Error("Hash da atualização não confere.");
  }
  spawnInstaller(target, platform);
  return target;
}
