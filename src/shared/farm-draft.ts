import type { AppConfig } from "./types";

export function settingsToSave(config: AppConfig): AppConfig {
  return { ...config, empresas: [] };
}
