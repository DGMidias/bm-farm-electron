import { contextBridge, ipcRenderer } from "electron";
import type { EmpresaCard } from "@shared/empresa";
import type { AppConfig, FarmEvent, FarmRunState, HistoryEvent, MenuId } from "@shared/types";

const api = {
  getConfig: () => ipcRenderer.invoke("config:get") as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke("config:save", config) as Promise<AppConfig>,
  getHistory: () => ipcRenderer.invoke("history:list") as Promise<HistoryEvent[]>,
  addHistory: (event: Omit<HistoryEvent, "id" | "timestamp">) =>
    ipcRenderer.invoke("history:add", event) as Promise<HistoryEvent[]>,
  testSms: () => ipcRenderer.invoke("sms:test"),
  listSmsServices: () => ipcRenderer.invoke("sms:services"),
  createSmsNumber: () => ipcRenderer.invoke("sms:create"),
  readSms: (activationId?: string) => ipcRenderer.invoke("sms:inbox", activationId),
  listSmsNumbers: () => ipcRenderer.invoke("sms:list-numbers"),
  cancelSmsNumber: (activationId: string) => ipcRenderer.invoke("sms:cancel", activationId),
  testEmail: () => ipcRenderer.invoke("email:test"),
  testAdsPower: () => ipcRenderer.invoke("adspower:test"),
  listAdsPowerProfiles: () => ipcRenderer.invoke("adspower:profiles"),
  probeAdsPower: () => ipcRenderer.invoke("adspower:probe"),
  createInbox: () => ipcRenderer.invoke("email:create"),
  deleteInbox: (address: string) => ipcRenderer.invoke("email:delete", address),
  listInboxes: () => ipcRenderer.invoke("email:list-inboxes"),
  listMail: (address?: string) => ipcRenderer.invoke("email:list", address),
  listLogs: () => ipcRenderer.invoke("log:list"),
  onLog: (handler: (entry: unknown) => void) => {
    const listener = (_event: unknown, entry: unknown) => handler(entry);
    ipcRenderer.on("log:entry", listener);
    return () => ipcRenderer.removeListener("log:entry", listener);
  },
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  applyUpdate: () => ipcRenderer.invoke("update:apply"),
  pickEmpresaDocument: (autoFill: boolean) => ipcRenderer.invoke("empresa:pick-document", autoFill) as Promise<{ path: string; fields: Partial<EmpresaCard> } | undefined>,
  startSession: (empresaId: string, card?: EmpresaCard) => ipcRenderer.invoke("engine:start", empresaId, card),
  startFarm: (cards: EmpresaCard[], batchSize: number) => ipcRenderer.invoke("farm:start", cards, batchSize) as Promise<FarmRunState>,
  stopFarm: () => ipcRenderer.invoke("farm:stop") as Promise<FarmRunState>,
  reportFarmScreen: (empresaId: string) => ipcRenderer.invoke("farm:report", empresaId) as Promise<FarmRunState>,
  dismissFarmCompany: (empresaId: string) => ipcRenderer.invoke("farm:dismiss", empresaId) as Promise<FarmRunState>,
  dismissFarm: () => ipcRenderer.invoke("farm:dismiss-all") as Promise<FarmRunState>,
  farmState: () => ipcRenderer.invoke("farm:state") as Promise<FarmRunState>,
  detectScreen: () => ipcRenderer.invoke("engine:detect"),
  fillStep: (empresaId: string, step: string, card?: EmpresaCard) => ipcRenderer.invoke("engine:fill", empresaId, step, card),
  resumeHuman: (pauseId: string) => ipcRenderer.invoke("engine:resume", pauseId),
  stopSession: () => ipcRenderer.invoke("engine:stop"),
  engineStatus: () => ipcRenderer.invoke("engine:status"),
  saveSnapshot: (classifiedAs: string) => ipcRenderer.invoke("map:save-snapshot", classifiedAs),
  onFarmEvent: (handler: (event: FarmEvent) => void) => {
    const listener = (_event: unknown, event: FarmEvent) => handler(event);
    ipcRenderer.on("farm:event", listener);
    return () => ipcRenderer.removeListener("farm:event", listener);
  },
  onFarmState: (handler: (state: FarmRunState) => void) => {
    const listener = (_event: unknown, state: FarmRunState) => handler(state);
    ipcRenderer.on("farm:state", listener);
    return () => ipcRenderer.removeListener("farm:state", listener);
  },
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
