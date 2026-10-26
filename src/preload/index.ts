import { contextBridge, ipcRenderer } from "electron";
import type { EmpresaCard } from "@shared/empresa";
import type { AppConfig, HistoryEvent, MenuId } from "@shared/types";

const api = {
  getConfig: () => ipcRenderer.invoke("config:get") as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke("config:save", config) as Promise<AppConfig>,
  getHistory: () => ipcRenderer.invoke("history:list") as Promise<HistoryEvent[]>,
  addHistory: (event: Omit<HistoryEvent, "id" | "timestamp">) =>
    ipcRenderer.invoke("history:add", event) as Promise<HistoryEvent[]>,
  testSms: () => ipcRenderer.invoke("sms:test"),
  testAdsPower: () => ipcRenderer.invoke("adspower:test"),
  createInbox: () => ipcRenderer.invoke("email:create"),
  listMail: () => ipcRenderer.invoke("email:list"),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  applyUpdate: () => ipcRenderer.invoke("update:apply"),
  startSession: (empresaId: string) => ipcRenderer.invoke("engine:start", empresaId),
  detectScreen: () => ipcRenderer.invoke("engine:detect"),
  fillStep: (empresaId: string, step: string) => ipcRenderer.invoke("engine:fill", empresaId, step),
  resumeHuman: (pauseId: string) => ipcRenderer.invoke("engine:resume", pauseId),
  stopSession: () => ipcRenderer.invoke("engine:stop"),
  engineStatus: () => ipcRenderer.invoke("engine:status"),
  saveSnapshot: (classifiedAs: string) => ipcRenderer.invoke("map:save-snapshot", classifiedAs),
  platform: () => ipcRenderer.invoke("app:platform") as Promise<{ id: string; modKey: string; version: string }>,
  onPause: (handler: (pause: unknown) => void) => {
    const listener = (_event: unknown, pause: unknown) => handler(pause);
    ipcRenderer.on("engine:pause", listener);
    return () => ipcRenderer.removeListener("engine:pause", listener);
  },
};

export type DesktopApi = typeof api;

contextBridge.exposeInMainWorld("desktop", api);

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

void (0 as unknown as MenuId);
void (0 as unknown as EmpresaCard);
