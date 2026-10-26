import { app, BrowserWindow, ipcMain, shell } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { joinPath, modKey, platformId, userDataPath } from "@harness/compat";
import { validateEmpresa } from "@shared/empresa";
import type { AppConfig, HistoryEvent } from "@shared/types";
import { testAdsPower } from "./adspower";
import { FarmEngine, loadPageMap } from "./engine";
import { createInbox, listMessages } from "./mail-tm";
import { testSms } from "./sms";
import { LocalStore } from "./store";
import { checkUpdate, downloadAndInstall, fetchLatest } from "./updater";

const mainDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = joinPath(mainDir, "..", "..");
const store = new LocalStore({ root: app.isPackaged ? userDataPath() : joinPath(repoRoot, "userData") });
const engine = new FarmEngine(repoRoot, loadPageMap(repoRoot));

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: joinPath(mainDir, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  window.on("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith("http://localhost") || url.startsWith("file:");
    if (!allowed) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(joinPath(fileURLToPath(new URL(".", import.meta.url)), "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  const snapshotsDir = joinPath(repoRoot, "mapas", "snapshots");
  mkdirSync(snapshotsDir, { recursive: true });

  ipcMain.handle("app:platform", () => ({
    id: platformId(),
    modKey: modKey(),
    version: app.getVersion(),
  }));

  ipcMain.handle("config:get", () => store.readConfig());
  ipcMain.handle("config:save", (_event, config: AppConfig) => {
    store.writeConfig(config);
    return store.readConfig();
  });
  ipcMain.handle("history:list", () => store.readHistory());
  ipcMain.handle("history:add", (_event, partial: Omit<HistoryEvent, "id" | "timestamp">) => {
    return store.appendHistory({
      ...partial,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  });
  ipcMain.handle("sms:test", async () => testSms(store.readConfig().sms));
  ipcMain.handle("adspower:test", async () => testAdsPower(store.readConfig().adspower));
  ipcMain.handle("email:create", async () => {
    const config = store.readConfig();
    const inbox = await createInbox(config.email);
    config.email.lastAddress = inbox.address;
    config.email.lastToken = inbox.token;
    config.email.password = inbox.password;
    store.writeConfig(config);
    return { address: inbox.address, messages: [] };
  });
  ipcMain.handle("email:list", async () => {
    const token = store.readConfig().email.lastToken;
    if (!token) return [];
    return listMessages(token);
  });
  ipcMain.handle("update:check", async () => checkUpdate(app.getVersion(), store.readConfig().update.latestUrl));
  ipcMain.handle("update:apply", async () => {
    const config = store.readConfig();
    const latest = await fetchLatest(config.update.latestUrl);
    const artifact = latest[platformId()];
    if (!artifact) throw new Error("Sem artefato para este sistema.");
    const dir = joinPath(store.root, "updates");
    mkdirSync(dir, { recursive: true });
    return downloadAndInstall(artifact.url, artifact.sha512, dir);
  });
  ipcMain.handle("engine:start", async (_event, empresaId: string) => {
    const config = store.readConfig();
    const card = config.empresas.find((item) => item.id === empresaId);
    if (!card) throw new Error("Empresa não encontrada.");
    const errors = validateEmpresa(card);
    if (errors.length) throw new Error(errors[0]);
    const status = await engine.start(config.adspower, card);
    store.appendHistory({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      empresaId: card.id,
      razaoSocial: card.razao_social,
      cnpj: card.cnpj,
      adspowerProfile: card.adspower_profile,
      etapa: "sessao",
      status: "em_andamento",
      mensagem: "Sessão AdsPower iniciada (CDP).",
    });
    return status;
  });
  ipcMain.handle("engine:detect", async () => engine.detect());
  ipcMain.handle("engine:fill", async (_event, empresaId: string, step: string) => {
    const card = store.readConfig().empresas.find((item) => item.id === empresaId);
    if (!card) throw new Error("Empresa não encontrada.");
    return engine.fillStep(card, step as "portfolio");
  });
  ipcMain.handle("engine:resume", (_event, pauseId: string) => {
    engine.resume(pauseId);
    return engine.status();
  });
  ipcMain.handle("engine:stop", async () => {
    await engine.stop(store.readConfig().adspower);
    return engine.status();
  });
  ipcMain.handle("engine:status", () => engine.status());
  ipcMain.handle("map:save-snapshot", async (_event, classifiedAs: string) => {
    const snapshot = await engine.snapshot();
    snapshot.classifiedAs = classifiedAs;
    const file = joinPath(snapshotsDir, `${Date.now()}-${classifiedAs.replace(/\W+/g, "_")}.json`);
    writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
    return { file, snapshot };
  });

  engine.on("pause", (pause) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("engine:pause", pause);
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (platformId() !== "mac") app.quit();
});
