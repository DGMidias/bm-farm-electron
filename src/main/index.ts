import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirName, downloadsPath, joinPath, modKey, pdfPickerPath, platformId, userDataPath } from "@harness/compat";
import { DEFAULT_DDD, isBrDdd } from "@shared/ddd";
import { validateEmpresa, validateFarmStart, type EmpresaCard } from "@shared/empresa";
import { clampBatchSize } from "@shared/farm-etapas";
import type { AppConfig, FarmEvent, HistoryEvent, HumanPause } from "@shared/types";
import { ADSPOWER_PROBE_URL, listAdsPowerProfiles, testAdsPower } from "./adspower";
import { FarmEngine, loadPageMap } from "./engine";
import { FarmOrchestrator } from "./farm-orchestrator";
import { createInbox, probeInbox, rememberInbox, refreshInboxMessages, testEmail } from "./mail-tm";
import { configureLogger, listLogs, log, logError, onLog } from "./log";
import { cancelSmsActivation, createSmsNumber, listSmsActivations, listSmsServices, normalizeDdd, normalizeSmsBase, persistActivationSnapshot, readSmsActivation, rememberActivation, sanitizeSmsKey, testSms } from "./sms";
import { LocalStore } from "./store";
import { readEmpresaDocument } from "./pdf-empresa";
import { checkUpdate, downloadAndInstall, fetchLatest } from "./updater";

const mainDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = joinPath(mainDir, "..", "..");
const store = new LocalStore({ root: app.isPackaged ? userDataPath() : joinPath(repoRoot, "userData") });
async function persistCompanyInbox(card: Pick<EmpresaCard, "id" | "razao_social" | "adspower_profile">) {
  const config = store.readConfig();
  const inbox = await createInbox(config.email, {
    empresaId: card.id,
    razaoSocial: card.razao_social,
    adspowerProfile: card.adspower_profile,
  });
  config.email.lastAddress = inbox.address;
  config.email.lastToken = inbox.token;
  config.email.password = inbox.password;
  config.email.knownInboxes = rememberInbox(config.email.knownInboxes, inbox);
  config.empresas = (config.empresas ?? []).map((item) =>
    item.id === card.id ? { ...item, email_comercial: inbox.address } : item,
  );
  store.writeConfig(config);
  return inbox;
}

const engine = new FarmEngine(repoRoot, loadPageMap(repoRoot), persistCompanyInbox);
const orchestrator = new FarmOrchestrator(repoRoot, persistCompanyInbox);

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

function broadcastLog(entry: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("log:entry", entry);
  }
}

function resolveEmpresa(empresaId: unknown, maybeCard: unknown, config: AppConfig): EmpresaCard | undefined {
  const draft = maybeCard as EmpresaCard | undefined;
  if (draft && typeof draft === "object" && draft.id === empresaId) return draft;
  return config.empresas.find((item) => item.id === empresaId);
}

function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(channel, error);
      throw error;
    }
  });
}

app.whenReady().then(() => {
  configureLogger(store.root);
  onLog(broadcastLog);
  log("info", "app", `processo principal pronto (${platformId()})`);
  const snapshotsDir = joinPath(repoRoot, "mapas", "snapshots");
  mkdirSync(snapshotsDir, { recursive: true });
  mkdirSync(joinPath(repoRoot, "mapas", "captures"), { recursive: true });

  handle("app:platform", () => ({
    id: platformId(),
    modKey: modKey(),
    version: app.getVersion(),
  }));

  handle("config:get", () => store.readConfig());
  handle("config:save", (config) => {
    const next = config as AppConfig;
    next.sms.apiKey = sanitizeSmsKey(next.sms.apiKey);
    next.sms.baseUrl = normalizeSmsBase(next.sms.baseUrl);
    if (next.sms.countryCode.trim().toUpperCase() === "BRA") next.sms.countryCode = "BR";
    const ddd = normalizeDdd(next.sms.ddd);
    next.sms.ddd = isBrDdd(ddd) ? ddd : DEFAULT_DDD;
    store.writeConfig(next);
    return store.readConfig();
  });
  handle("history:list", () => store.readHistory());
  handle("history:add", (partial) => {
    return store.appendHistory({
      ...(partial as Omit<HistoryEvent, "id" | "timestamp">),
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  });
  handle("log:list", () => listLogs());
  handle("sms:test", () => testSms(store.readConfig().sms));
  handle("sms:services", () => listSmsServices(store.readConfig().sms));
  handle("sms:create", async () => {
    const config = store.readConfig();
    const activation = await createSmsNumber(config.sms);
    config.sms.lastActivationId = activation.id;
    config.sms.lastPhone = activation.phone;
    const remembered = rememberActivation(config.sms.knownActivations, activation);
    const live = await listSmsActivations({ ...config.sms, knownActivations: remembered });
    const snapshot = persistActivationSnapshot(config.sms, activation.id ? [activation, ...live] : live);
    config.sms.knownActivations = snapshot.knownActivations;
    config.sms.activationChanges = snapshot.activationChanges;
    store.writeConfig(config);
    log("info", "sms", `número gerado ${activation.phone} ddd=${activation.ddd ?? config.sms.ddd} status=${activation.status}`);
    return activation;
  });
  handle("sms:inbox", async (activationId) => {
    const config = store.readConfig();
    const id = String(activationId || config.sms.lastActivationId || "").trim();
    if (!id) throw new Error("Gere um número ou informe o ID da ativação para ler o SMS.");
    const activation = await readSmsActivation(config.sms, id);
    config.sms.lastActivationId = activation.id;
    config.sms.lastPhone = activation.phone;
    const snapshot = persistActivationSnapshot(config.sms, [activation]);
    config.sms.knownActivations = snapshot.knownActivations;
    config.sms.activationChanges = snapshot.activationChanges;
    store.writeConfig(config);
    return activation;
  });
  handle("sms:list-numbers", async () => {
    const config = store.readConfig();
    const live = await listSmsActivations(config.sms);
    const snapshot = persistActivationSnapshot(config.sms, live);
    config.sms.knownActivations = snapshot.knownActivations;
    config.sms.activationChanges = snapshot.activationChanges;
    store.writeConfig(config);
    return snapshot.knownActivations;
  });
  handle("sms:cancel", async (activationId) => {
    const id = String(activationId ?? "").trim();
    if (!id) throw new Error("Informe o número para cancelar.");
    const config = store.readConfig();
    const result = await cancelSmsActivation(config.sms, id);
    const updated = {
      ...(config.sms.knownActivations ?? []).find((item) => item.id === id),
      id,
      phone: config.sms.knownActivations?.find((item) => item.id === id)?.phone ?? "",
      status: result.status || "cancelled",
      messages: config.sms.knownActivations?.find((item) => item.id === id)?.messages ?? [],
    };
    config.sms.knownActivations = rememberActivation(config.sms.knownActivations, updated);
    const live = await listSmsActivations(config.sms);
    const snapshot = persistActivationSnapshot(config.sms, live);
    config.sms.knownActivations = snapshot.knownActivations;
    config.sms.activationChanges = snapshot.activationChanges;
    store.writeConfig(config);
    log("info", "sms", `cancelou ${id} status=${result.status} reembolso=${result.refunded ? "sim" : "pendente"}`);
    return result;
  });
  handle("adspower:test", () => testAdsPower(store.readConfig().adspower));
  handle("adspower:profiles", () => listAdsPowerProfiles(store.readConfig().adspower));
  handle("adspower:probe", () => {
    const config = store.readConfig();
    return engine.startProfile(config.adspower, config.adspower.testProfile, ADSPOWER_PROBE_URL);
  });
  handle("email:test", () => testEmail());
  handle("email:create", async () => {
    const config = store.readConfig();
    const inbox = await createInbox(config.email);
    config.email.lastAddress = inbox.address;
    config.email.lastToken = inbox.token;
    config.email.password = inbox.password;
    config.email.knownInboxes = rememberInbox(config.email.knownInboxes, inbox);
    store.writeConfig(config);
    log("info", "email", `caixa ${inbox.address}`);
    return inbox;
  });
  handle("email:list-inboxes", async () => {
    const config = store.readConfig();
    const next = [];
    for (const inbox of config.email.knownInboxes ?? []) {
      next.push(await probeInbox(inbox));
    }
    config.email.knownInboxes = next;
    store.writeConfig(config);
    return next;
  });
  handle("email:list", async (address) => {
    const config = store.readConfig();
    const wanted = String(address || config.email.lastAddress || "").trim();
    const current = (config.email.knownInboxes ?? []).find((item) => item.address === wanted);
    if (!current?.token && !config.email.lastToken) return [];
    const inbox = current ?? {
      id: wanted,
      address: wanted,
      token: config.email.lastToken,
      password: config.email.password,
      createdAt: new Date().toISOString(),
      active: true,
      messages: [],
    };
    const refreshed = await refreshInboxMessages(inbox);
    config.email.lastAddress = refreshed.address;
    config.email.lastToken = refreshed.token;
    config.email.knownInboxes = rememberInbox(config.email.knownInboxes, refreshed);
    store.writeConfig(config);
    return refreshed.messages;
  });
  handle("empresa:pick-document", async (autoFill) => {
    const config = store.readConfig();
    const downloads = app.getPath("downloads") || downloadsPath();
    const chosen = await dialog.showOpenDialog({
      title: "Comprovante CNPJ",
      defaultPath: pdfPickerPath(config.farm.lastPdfDir, downloads, existsSync),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      properties: ["openFile"],
    });
    if (chosen.canceled || !chosen.filePaths[0]) return undefined;
    config.farm.lastPdfDir = dirName(chosen.filePaths[0]);
    store.writeConfig(config);
    return readEmpresaDocument(chosen.filePaths[0], Boolean(autoFill));
  });
  handle("update:check", () => checkUpdate(app.getVersion(), store.readConfig().update.latestUrl));
  handle("update:apply", async () => {
    const config = store.readConfig();
    const latest = await fetchLatest(config.update.latestUrl);
    const artifact = latest[platformId()];
    if (!artifact) throw new Error("Sem artefato para este sistema.");
    const dir = joinPath(store.root, "updates");
    mkdirSync(dir, { recursive: true });
    return downloadAndInstall(artifact.url, artifact.sha512, dir);
  });
  handle("engine:start", async (empresaId, maybeCard) => {
    const config = store.readConfig();
    const card = resolveEmpresa(empresaId, maybeCard, config);
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
  handle("engine:detect", () => engine.detect());
  handle("engine:fill", (empresaId, step, maybeCard) => {
    const card = resolveEmpresa(empresaId, maybeCard, store.readConfig());
    if (!card) throw new Error("Empresa não encontrada.");
    return engine.fillStep(card, step as "portfolio");
  });
  handle("farm:start", async (maybeCards, maybeBatch) => {
    const config = store.readConfig();
    const cards = Array.isArray(maybeCards) && maybeCards.length ? (maybeCards as EmpresaCard[]) : config.empresas;
    const ads = await testAdsPower(config.adspower);
    if (!ads.ok) throw new Error(ads.mensagem || "AdsPower local indisponível.");
    const profiles = await listAdsPowerProfiles(config.adspower).catch(() => []);
    const known = profiles.flatMap((item) => [item.userId, item.serial].filter((value): value is string => Boolean(value)));
    const errors = validateFarmStart(cards, known);
    if (errors.length) throw new Error(errors[0]);
    const batch = clampBatchSize(Number(maybeBatch ?? config.farm.batchSize), cards.length);
    config.empresas = cards;
    config.farm.started = true;
    config.farm.batchSize = batch;
    store.writeConfig(config);
    for (const card of cards) {
      store.appendHistory({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        empresaId: card.id,
        razaoSocial: card.razao_social,
        cnpj: card.cnpj,
        adspowerProfile: card.adspower_profile,
        etapa: "portfolio",
        status: "em_andamento",
        mensagem: "Farm iniciado (portfólio).",
      });
    }
    return orchestrator.start(config, cards, batch);
  });
  handle("farm:stop", () => orchestrator.stop(store.readConfig().adspower));
  handle("farm:report", (empresaId) => orchestrator.report(String(empresaId), store.readConfig().adspower));
  handle("farm:dismiss", (empresaId) => orchestrator.dismiss(String(empresaId)));
  handle("farm:dismiss-all", () => orchestrator.dismissAll());
  handle("farm:state", () => orchestrator.getState());
  handle("engine:resume", (pauseId) => {
    const id = String(pauseId);
    orchestrator.resume(id);
    engine.resume(id);
    return { engine: engine.status(), farm: orchestrator.getState() };
  });
  handle("engine:stop", async () => {
    await engine.stop(store.readConfig().adspower);
    return engine.status();
  });
  handle("engine:status", () => engine.status());
  handle("map:save-snapshot", async (classifiedAs) => {
    const snapshot = await engine.snapshot();
    snapshot.classifiedAs = String(classifiedAs);
    const file = joinPath(snapshotsDir, `${Date.now()}-${String(classifiedAs).replace(/\W+/g, "_")}.json`);
    writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
    return { file, snapshot };
  });

  const broadcast = (channel: string, payload: unknown) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channel, payload);
    }
  };
  engine.on("pause", (pause: HumanPause) => broadcast("engine:pause", pause));
  orchestrator.on("pause", (pause: HumanPause) => broadcast("engine:pause", pause));
  orchestrator.on("event", (event: FarmEvent) => broadcast("farm:event", event));
  orchestrator.on("state", (state) => broadcast("farm:state", state));
  orchestrator.on("company", ({ card, result }: { card: EmpresaCard; result: "ok" | "paused" | "erro" }) => {
    store.appendHistory({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      empresaId: card.id,
      razaoSocial: card.razao_social,
      cnpj: card.cnpj,
      adspowerProfile: card.adspower_profile,
      etapa: "portfolio",
      status: result === "ok" ? "ok" : result === "paused" ? "pausado_humano" : "erro",
      mensagem:
        result === "ok"
          ? `Portfólio criado · ${card.razao_social} · ${card.email_comercial}.`
          : result === "paused"
            ? "Pausa humana."
            : "Falha no portfólio.",
    });
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (platformId() !== "mac") app.quit();
});
