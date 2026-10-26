import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

export type PlatformId = "win" | "mac" | "linux";

export interface LatestArtifact {
  url: string;
  sha512: string;
}

export interface LatestJson {
  version: string;
  notes?: string;
  win?: LatestArtifact;
  mac?: LatestArtifact;
  linux?: LatestArtifact;
}

export function platformId(platform = process.platform): PlatformId {
  if (platform === "darwin") return "mac";
  if (platform === "win32") return "win";
  return "linux";
}

export function modKey(platform = process.platform): "Control" | "Meta" {
  return platformId(platform) === "mac" ? "Meta" : "Control";
}

export function accelerator(key: string, platform = process.platform): string {
  const prefix = platformId(platform) === "mac" ? "Cmd" : "Ctrl";
  return `${prefix}+${key}`;
}

export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

export function userDataPath(appName = "electron-bm-farm", platform = process.platform): string {
  const home = homedir();
  const id = platformId(platform);
  if (id === "win") {
    const appData = process.env.APPDATA || joinPath(home, "AppData", "Roaming");
    return joinPath(appData, appName);
  }
  if (id === "mac") {
    return joinPath(home, "Library", "Application Support", appName);
  }
  return joinPath(home, ".config", appName);
}

export function artifactForPlatform(latest: LatestJson, platform = process.platform): LatestArtifact | undefined {
  return latest[platformId(platform)];
}

export function expectedArtifactSuffix(platform = process.platform): ".exe" | ".zip" | ".dmg" | ".AppImage" {
  const id = platformId(platform);
  if (id === "win") return ".exe";
  if (id === "mac") return ".zip";
  return ".AppImage";
}

export function artifactMatchesPlatform(url: string, platform = process.platform): boolean {
  const lower = url.toLowerCase();
  const id = platformId(platform);
  if (id === "win") return lower.endsWith(".exe");
  if (id === "mac") return lower.endsWith(".zip") || lower.endsWith(".dmg");
  return lower.endsWith(".appimage");
}

export function spawnInstaller(filePath: string, platform = process.platform): void {
  const id = platformId(platform);
  if (id === "win") {
    spawn(filePath, [], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (id === "mac") {
    spawn("open", [filePath], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn(filePath, [], { detached: true, stdio: "ignore" }).unref();
}
