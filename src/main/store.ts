import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { joinPath } from "@harness/compat";
import { settingsToSave } from "@shared/farm-draft";
import { DEFAULT_CONFIG, type AppConfig, type HistoryEvent } from "@shared/types";

export interface StorePaths {
  root: string;
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class LocalStore {
  constructor(private readonly paths: StorePaths) {
    mkdirSync(paths.root, { recursive: true });
  }

  get root(): string {
    return this.paths.root;
  }

  private file(name: string): string {
    return joinPath(this.paths.root, name);
  }

  readConfig(): AppConfig {
    try {
      const parsed = safeParse(readFileSync(this.file("config.json"), "utf8"), DEFAULT_CONFIG);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        sms: { ...DEFAULT_CONFIG.sms, ...parsed.sms },
        email: { ...DEFAULT_CONFIG.email, ...parsed.email },
        adspower: { ...DEFAULT_CONFIG.adspower, ...parsed.adspower },
        update: { ...DEFAULT_CONFIG.update, ...parsed.update },
        farm: { ...DEFAULT_CONFIG.farm, ...parsed.farm },
        empresas: (parsed.empresas ?? []).map((item) => ({
          ...item,
          ler_pdf_automatico: item.ler_pdf_automatico !== false,
        })),
      };
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  writeConfig(config: AppConfig): void {
    writeFileSync(this.file("config.json"), JSON.stringify(settingsToSave(config), null, 2), "utf8");
  }

  readHistory(): HistoryEvent[] {
    try {
      return safeParse(readFileSync(this.file("history.json"), "utf8"), []);
    } catch {
      return [];
    }
  }

  appendHistory(event: HistoryEvent): HistoryEvent[] {
    const all = [event, ...this.readHistory()].slice(0, 1000);
    writeFileSync(this.file("history.json"), JSON.stringify(all, null, 2), "utf8");
    return all;
  }

  redactForLog(value: string): string {
    if (!value) return "";
    if (value.length <= 6) return "***";
    return `${value.slice(0, 2)}…${value.slice(-2)}`;
  }
}
