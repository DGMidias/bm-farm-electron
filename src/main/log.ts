import { appendFileSync, mkdirSync } from "node:fs";
import { joinPath } from "@harness/compat";
import type { AppLog, LogLevel } from "@shared/types";

export type { AppLog, LogLevel };

const ring: AppLog[] = [];
const listeners = new Set<(entry: AppLog) => void>();
let logFile = "";

export function redactSecrets(text: string): string {
  return text
    .replace(/nv_live[_-][A-Za-z0-9]+/gi, "nv_live_***")
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]+/g, "[jwt]")
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,]+/gi, "$1***");
}

export function configureLogger(root: string): void {
  const dir = joinPath(root, "logs");
  mkdirSync(dir, { recursive: true });
  logFile = joinPath(dir, "app.log");
}

export function onLog(listener: (entry: AppLog) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listLogs(): AppLog[] {
  return [...ring];
}

export function log(level: LogLevel, scope: string, message: string, extra?: unknown): AppLog {
  const detail = extra === undefined ? "" : ` ${typeof extra === "string" ? extra : JSON.stringify(extra)}`;
  const entry: AppLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    scope,
    message: redactSecrets(`${message}${detail}`),
  };
  ring.unshift(entry);
  ring.splice(300);
  const line = `${entry.timestamp} [${entry.level}] [${entry.scope}] ${entry.message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  if (logFile) {
    try {
      appendFileSync(logFile, `${line}\n`, "utf8");
    } catch {
      /* o console já recebeu a linha */
    }
  }
  for (const listener of listeners) listener(entry);
  return entry;
}

export function logError(scope: string, error: unknown, message = "falhou"): AppLog {
  const detail = error instanceof Error ? error.message : String(error);
  return log("error", scope, `${message}: ${detail}`);
}
