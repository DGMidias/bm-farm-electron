import type { AppConfig } from "./types";

export function settingsToSave(config: AppConfig): AppConfig {
  if (config.farm.started) return config;
  return { ...config, empresas: [] };
}
