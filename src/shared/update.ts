import {
  artifactForPlatform,
  artifactMatchesPlatform,
  type LatestJson,
} from "@harness/compat";
import { isRemoteNewer } from "./semver";

export const DEFAULT_LATEST_URL = "https://github.com/DGMidias/bm-farm-electron/releases/latest/download/latest.json";

export function resolveLatestUrl(configured?: string): string {
  return configured?.trim() || DEFAULT_LATEST_URL;
}

export function evaluateUpdate(
  current: string,
  latest: LatestJson,
  platform = process.platform,
): { newer: boolean; artifactUrl?: string; reason: string } {
  if (!isRemoteNewer(current, latest.version)) {
    return { newer: false, reason: "O app já está na versão mais recente." };
  }
  const artifact = artifactForPlatform(latest, platform);
  if (!artifact?.url) {
    return { newer: true, reason: "Há versão nova, mas sem artefato para este sistema." };
  }
  if (!artifactMatchesPlatform(artifact.url, platform)) {
    return { newer: true, reason: "Artefato remoto não corresponde a este sistema." };
  }
  if (!artifact.sha512) {
    return { newer: true, reason: "Artefato sem hash; recusado." };
  }
  return { newer: true, artifactUrl: artifact.url, reason: "Atualização disponível." };
}

export function verifySha512(actualHex: string, expected: string): boolean {
  return actualHex.toLowerCase() === expected.toLowerCase();
}
