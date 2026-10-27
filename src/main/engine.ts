import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { joinPath } from "@harness/compat";
import { FIELDS_FOR, type EmpresaCard } from "@shared/empresa";
import {
  isDuplicatePortfolioError,
  portfolioEtapaConcluida,
  PORTFOLIO_URL,
  shouldGeneratePortfolioInbox,
  shouldRedirectToBusinessUsers,
  SKIP_COMPLETED_ETAPA,
} from "@shared/farm-etapas";
import {
  businessIdFromUrl,
  formatEtapaSkippedLog,
  formatFarmDetachLog,
  formatNotLoggedInLog,
  formatPortfolioCreatedLog,
  formatPortfolioFilledLog,
  formatPortfolioRedirectLog,
  formatSuiteUnavailableRedirectLog,
  formatTempEmailLog,
  KEEP_ADSPOWER_OPEN_ON_END,
  shouldLogDetach,
} from "@shared/farm-log";
import { detectScreen, type PageMap } from "@shared/map";
import { metaNeedsLogin } from "@shared/meta-session";
import {
  clickCreateButton,
  clickSwitcherCreate,
  extractBusinessPortfolioNames,
  fillPortfolioFields,
  clickContinueSession,
  clickPostCreateStep,
  isPortfolioCreateForm,
  openPortfolioModal,
  shouldClickContinueSession,
  openSwitcher,
  postCreateStep,
  splitFacebookName,
} from "@shared/portfolio-fill";
import type { AdsPowerConfig, EngineStatus, FarmEvent, HumanPause, ScreenSnapshot } from "@shared/types";
import { isProfileActive, startProfile } from "./adspower";
import { log, logError } from "./log";
import type { CaptureReason } from "@shared/page-capture";
import { savePageCapture, snapshotFromPage } from "./page-capture";
import { smsReady } from "./sms";

export type CreateCompanyInbox = (
  card: Pick<EmpresaCard, "id" | "razao_social" | "adspower_profile">,
) => Promise<{ address: string }>;

export function loadPageMap(repoRoot: string): PageMap {
  const file = joinPath(repoRoot, "mapas", "meta-bm.v1.json");
  return JSON.parse(readFileSync(file, "utf8")) as PageMap;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FarmEngine extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private profile: string | null = null;
  private pause: HumanPause | null = null;
  private running = false;
  private openedByUs = false;
  private empresaId?: string;
  private waiters = new Map<string, () => void>();
  private stopping = false;
  private detached = false;

  constructor(
    private readonly repoRoot: string,
    private readonly map: PageMap,
    private readonly createCompanyInbox?: CreateCompanyInbox,
  ) {
    super();
  }

  private capturesRoot(): string {
    return joinPath(this.repoRoot, "mapas", "captures");
  }

  status(): EngineStatus {
    return {
      running: this.running,
      profile: this.profile ?? undefined,
      screen: undefined,
      pause: this.pause ?? undefined,
      mensagem: this.running ? "Sessão AdsPower aberta." : "Motor ocioso.",
    };
  }

  private emitLog(level: FarmEvent["level"], message: string): void {
    const event: FarmEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      empresaId: this.empresaId,
      level,
      message,
    };
    this.emit("log", event);
    log(level === "error" ? "error" : level === "warn" ? "warn" : "info", "farm", message);
  }

  async startProfile(config: AdsPowerConfig, profileId: string, openUrl?: string): Promise<EngineStatus> {
    if (this.running) throw new Error("Já existe uma sessão. Encerre antes de abrir outra.");
    if (!profileId.trim()) throw new Error("Informe o perfil AdsPower (user_id ou serial).");
    const id = profileId.trim();
    const wasActive = await isProfileActive(config, id);
    this.emitLog("info", `Abrindo perfil ${id}…`);
    const ws = await startProfile(config, id);
    this.openedByUs = !wasActive;
    this.browser = await chromium.connectOverCDP(ws);
    this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());
    this.page = await this.context.newPage();
    this.profile = id;
    this.running = true;
    this.emitLog("info", "Aba nova…");
    if (openUrl) {
      await this.page.goto(openUrl, { waitUntil: "domcontentloaded" });
    }
    const url = this.page.url();
    const title = await this.page.title();
    this.emit("status", this.status());
    log("info", "adspower", `CDP perfil ${this.profile} ${title} ${url}`);
    return {
      ...this.status(),
      mensagem: `CDP conectado no perfil ${this.profile}. Aba: ${title || "(sem título)"} · ${url || "sem URL"}.`,
    };
  }

  async start(config: AdsPowerConfig, card: EmpresaCard): Promise<EngineStatus> {
    this.empresaId = card.id;
    return this.startProfile(config, card.adspower_profile);
  }

  async snapshot(): Promise<ScreenSnapshot> {
    if (!this.page) throw new Error("Nenhuma sessão Playwright/CDP.");
    return snapshotFromPage(this.page);
  }

  async detect(): Promise<{ nodeId: string; snapshot: ScreenSnapshot; human?: HumanPause["reason"] }> {
    const snapshot = await this.snapshot();
    const node = detectScreen(this.map, snapshot);
    if (node.human && node.id !== "unknown") {
      this.pause = {
        id: crypto.randomUUID(),
        empresaId: this.empresaId,
        reason: node.human,
        message: `Tela ${node.id} exige intervenção humana (${node.human}).`,
      };
      this.emit("pause", this.pause);
    }
    return { nodeId: node.id, snapshot, human: node.human };
  }

  async fillStep(card: EmpresaCard, step: keyof typeof FIELDS_FOR): Promise<number> {
    if (!this.page) throw new Error("Nenhuma sessão.");
    const hostname = new URL(this.page.url()).hostname;
    if (!hostname.endsWith("facebook.com") && !hostname.endsWith("meta.com")) {
      throw new Error("Preenchimento só no Chromium do AdsPower em facebook.com/meta.com.");
    }
    const fields = FIELDS_FOR[step];
    let filled = 0;
    for (const [label, key] of fields) {
      const value = String(card[key as keyof EmpresaCard] ?? "");
      if (!value) continue;
      const box = this.page.getByLabel(label, { exact: true }).or(this.page.getByPlaceholder(label, { exact: true }));
      if ((await box.count()) === 1) {
        await box.fill(value);
        filled += 1;
      }
    }
    return filled;
  }

  async captureForOperator(): Promise<{ saved: boolean; fingerprint: string; dir?: string; screenId: string }> {
    if (!this.page) throw new Error("Nenhuma sessão Playwright/CDP.");
    const snapshot = await this.snapshot();
    const node = detectScreen(this.map, snapshot);
    const result = await this.capture(node.id, "operator");
    return result ?? { saved: false, fingerprint: "", screenId: node.id };
  }

  private async capture(
    screenId: string,
    reason: CaptureReason = "auto",
  ): Promise<{ saved: boolean; fingerprint: string; dir?: string; screenId: string } | undefined> {
    if (!this.page) return undefined;
    this.emitLog("info", "Capturando tela…");
    try {
      const result = await savePageCapture(this.capturesRoot(), this.page, screenId, { reason });
      if (result.dir) this.emitLog("info", `Captura em ${result.dir}`);
      return result;
    } catch (error) {
      logError("farm", error, "captura");
      return undefined;
    }
  }

  private locatorScope(root: Pick<Page, "getByLabel" | "getByPlaceholder" | "getByRole">) {
    return {
      getByLabel: (name: string, options?: { exact?: boolean }) => root.getByLabel(name, options),
      getByPlaceholder: (name: string, options?: { exact?: boolean }) => root.getByPlaceholder(name, options),
      getByRole: (role: string, options?: { name?: string | RegExp; exact?: boolean }) =>
        root.getByRole(role as "button" | "link" | "combobox" | "menuitem", options),
    };
  }

  private scope() {
    if (!this.page) throw new Error("Nenhuma sessão.");
    return this.page;
  }

  private async waitForText(pattern: RegExp, ms = 5000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.stopping || !this.page) return false;
      const snap = await this.snapshot().catch(() => undefined);
      if (snap?.texts.some((line) => pattern.test(line))) return true;
      await sleep(250);
    }
    return false;
  }

  private async waitForPortfolioForm(ms = 5000): Promise<boolean> {
    if (!this.page) return false;
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.stopping) return false;
      const labeled = this.page
        .getByLabel("Nome do portfólio empresarial", { exact: true })
        .or(this.page.getByLabel("Business portfolio name", { exact: true }))
        .or(this.page.getByLabel("Nome da sua conta e empresa", { exact: true }))
        .or(this.page.getByLabel("Your business and account name", { exact: true }))
        .or(this.page.getByLabel("Seu email comercial", { exact: true }));
      if ((await labeled.count()) >= 1) return true;
      await sleep(250);
    }
    return false;
  }

  private async tryOpenLanding(): Promise<string | undefined> {
    if (!this.page) return undefined;
    this.emitLog("info", "Abrindo o modal do portfólio…");
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (this.stopping) return undefined;
      const clicked = await openPortfolioModal(this.locatorScope(this.page));
      if (clicked) {
        this.emitLog("info", `Cliquei em ${clicked}.`);
        await this.waitForPortfolioForm(5000);
        return clicked;
      }
      await sleep(400);
    }
    this.emitLog("warn", "CTA da landing não apareceu.");
    return undefined;
  }

  private filledLog(card: EmpresaCard, keys: string[], responsavel: string, email: string): string {
    return formatPortfolioFilledLog({
      razaoSocial: card.razao_social,
      responsavel,
      email,
      keys,
    });
  }

  private createdLog(card: EmpresaCard, url: string, responsavel: string, email: string): string {
    return formatPortfolioCreatedLog({
      razaoSocial: card.razao_social,
      responsavel,
      email,
      url,
    });
  }

  private async tryCaptchaOnce(): Promise<boolean> {
    if (!this.page) return false;
    const box = this.page
      .getByRole("checkbox")
      .or(this.page.getByText(/não sou um robô|i.?m not a robot|verificar/i));
    if ((await box.count()) === 0) return false;
    await box.first().click({ timeout: 2500 }).catch(() => undefined);
    return true;
  }

  async runPortfolio(config: AdsPowerConfig, card: EmpresaCard): Promise<"ok" | "paused" | "erro"> {
    this.empresaId = card.id;
    this.stopping = false;
    this.detached = false;
    let submitted = false;
    let fbName = "";
    let email = "";
    let mintedInbox = false;
    try {
      await this.startProfile(config, card.adspower_profile, PORTFOLIO_URL);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (this.stopping) return "erro";
        await sleep(800);
        const snapshot = await this.snapshot();
        const url = this.page?.url() ?? snapshot.url;
        const formOpen = (await this.createDialogOpen()) || isPortfolioCreateForm(snapshot.texts);
        if (metaNeedsLogin({ url, texts: snapshot.texts }) && !formOpen) {
          await this.capture("login");
          this.emitLog("warn", formatNotLoggedInLog(this.profile ?? card.adspower_profile));
          await this.requestHuman(
            "login",
            "Este perfil AdsPower não está logado na Meta. Faça login no Chromium do AdsPower e clique em Continuar.",
          );
          continue;
        }
        if (shouldClickContinueSession({ texts: snapshot.texts, formOpen })) {
          this.emitLog("info", "Chooser da Meta — continuar com o Facebook.");
          const continued = await clickContinueSession(this.locatorScope(this.page));
          if (!continued) {
            this.emitLog("warn", formatNotLoggedInLog(this.profile ?? card.adspower_profile));
            await this.requestHuman(
              "login",
              "Clique em Continuar com o Facebook no AdsPower (ou faça login) e depois em Continuar.",
            );
            continue;
          }
          this.emitLog("info", `Cliquei em ${continued}.`);
          await sleep(1500);
          continue;
        }
        if (formOpen) {
          this.emitLog("info", "Modal de criar portfólio aberto — preenchendo os campos.");
        }
        const node = detectScreen(this.map, snapshot);
        if (
          node.id === "portfolio.landing" ||
          node.id === "portfolio.form" ||
          node.id === "portfolio.create" ||
          node.id === "portfolio.switcher" ||
          node.id === "portfolio.existing" ||
          node.id === "portfolio.unavailable" ||
          node.id === "portfolio.settings_users" ||
          node.id === "portfolio.add_assets" ||
          node.id === "portfolio.add_people" ||
          node.id === "portfolio.confirm" ||
          node.id === "unknown"
        ) {
          await this.capture(node.id);
        }
        if ((node.id === "login" || node.human === "login") && !formOpen) {
          await this.capture("login");
          this.emitLog("warn", formatNotLoggedInLog(this.profile ?? card.adspower_profile));
          await this.requestHuman(
            "login",
            "Este perfil AdsPower não está logado na Meta. Faça login no Chromium do AdsPower e clique em Continuar.",
          );
          continue;
        }
        if (node.id === "checkpoint.captcha" || node.human === "captcha") {
          this.emitLog("info", "Tentando o checkbox do CAPTCHA…");
          await this.tryCaptchaOnce();
          await sleep(1500);
          const after = detectScreen(this.map, await this.snapshot());
          if (after.id === "checkpoint.captcha" || after.human === "captcha") {
            this.emitLog("warn", "Meta pediu CAPTCHA — clique no card");
            await this.requestHuman("captcha", "Resolva o CAPTCHA no Chromium do AdsPower e clique em Continuar.");
          }
          continue;
        }
        if (node.id === "portfolio.landing" && !formOpen) {
          const opened = await this.tryOpenLanding();
          if (!opened) {
            this.emitLog("warn", "Landing sem CTA — clique no card");
            await this.requestHuman("unknown_screen", "Abra o Business Suite no AdsPower e clique em Continuar.");
            continue;
          }
          const afterUrl = this.page?.url() ?? "";
          const after = await this.snapshot().catch(() => undefined);
          this.emitLog(
            "info",
            formatPortfolioRedirectLog({
              cta: opened,
              pageName: pageNameFromTexts(after?.texts ?? snapshot.texts, after?.title ?? snapshot.title),
              url: afterUrl,
            }),
          );
          continue;
        }
        const fullTexts = await this.pageLines(400);
        if (isDuplicatePortfolioError(fullTexts)) {
          this.emitLog(
            "info",
            formatEtapaSkippedLog({ etapa: "portfolio", pageName: card.razao_social, listed: true }),
          );
          return "ok";
        }
        const wizard = postCreateStep(fullTexts);
        if (wizard) {
          const advanced = await this.advancePostCreate(wizard);
          if (!advanced) continue;
          if (wizard === "confirm") submitted = true;
          continue;
        }
        const redirect = shouldRedirectToBusinessUsers({
          url,
          texts: [...snapshot.texts, ...fullTexts],
        });
        if (redirect && this.page) {
          const businessId = businessIdFromUrl(url) ?? businessIdFromUrl(redirect);
          this.emitLog(
            "info",
            formatSuiteUnavailableRedirectLog({ businessId: businessId ?? "", url: redirect }),
          );
          await this.page.goto(redirect, { waitUntil: "domcontentloaded" });
          continue;
        }
        if (node.id === "unknown" && /adsmanager\/onboarding/i.test(this.page?.url() ?? "")) {
          if (await this.tryOpenLanding()) continue;
          this.emitLog("warn", "Tela desconhecida — clique no card");
          await this.requestHuman("unknown_screen", "A tela não é o seletor do portfólio. Ajuste no AdsPower e clique em Continuar.");
          continue;
        }

        const createOpen = await this.createDialogOpen();
        if (createOpen && submitted) {
          this.emitLog("warn", "Modal de criação ainda aberto depois de enviar — não preencho de novo.");
          await this.clickDialogButton(["Cancelar", "Cancel"]);
          continue;
        }
        if (!createOpen) {
          const names = await this.readSwitcherNames();
          if (!names) {
            this.emitLog("warn", "Seletor de portfólios não abriu — clique no card");
            await this.capture("portfolio.switcher", "error");
            await this.requestHuman("unknown_screen", "Abra o seletor no canto superior esquerdo e clique em Continuar.");
            continue;
          }
          if (portfolioEtapaConcluida({ url: this.page?.url() ?? "", listedNames: names, razaoSocial: card.razao_social })) {
            if (submitted) {
              this.emitLog("info", this.createdLog(card, this.page?.url() ?? "", fbName || card.responsavel, email));
              return "ok";
            }
            if (SKIP_COMPLETED_ETAPA) {
              this.emitLog(
                "info",
                formatEtapaSkippedLog({ etapa: "portfolio", pageName: card.razao_social, listed: true }),
              );
              return "ok";
            }
          }
          if (submitted) {
            this.emitLog("warn", "A razão não apareceu no seletor — clique no card");
            await this.capture("portfolio.switcher", "error");
            await this.requestHuman("unknown_screen", "Confira se o portfólio entrou na lista e clique em Continuar.");
            continue;
          }
          this.emitLog("info", "Abrindo Criar um portfólio empresarial…");
          const created = await clickSwitcherCreate(this.locatorScope(this.scope()));
          if (!created) {
            this.emitLog("warn", "Criar um portfólio empresarial não apareceu — clique no card");
            await this.capture("portfolio.switcher", "error");
            await this.requestHuman("unknown_screen", "Clique em Criar um portfólio empresarial e depois em Continuar.");
            continue;
          }
          if (!(await this.waitForPortfolioForm(6000))) {
            this.emitLog("warn", "Modal do portfólio não abriu — clique no card");
            await this.capture("portfolio.create", "error");
            await this.requestHuman("unknown_screen", "Abra o modal Criar um portfólio empresarial e clique em Continuar.");
            continue;
          }
        }

        await this.capture("portfolio.create");
        const facebook = formOpen ? undefined : await this.readFacebookName();
        fbName =
          facebook ? `${facebook.nome} ${facebook.sobrenome}` : card.responsavel.trim() || (await this.readPrefillName());
        if (!fbName && !formOpen) {
          this.emitLog("warn", "Nome do Facebook não apareceu — clique no card");
          await this.requestHuman("unknown_screen", "Abra o menu da conta no canto superior direito para o farm ler o nome e clique em Continuar.");
          continue;
        }
        if (shouldGeneratePortfolioInbox(card) && !mintedInbox) {
          if (!this.createCompanyInbox) {
            this.emitLog("error", "Sem gerador de e-mail temporário.");
            return "erro";
          }
          try {
            const inbox = await this.createCompanyInbox(card);
            email = inbox.address;
            card.email_comercial = inbox.address;
            mintedInbox = true;
            this.emitLog("info", formatTempEmailLog({ address: inbox.address, razaoSocial: card.razao_social, profile: card.adspower_profile }));
          } catch (error) {
            this.emitLog("error", error instanceof Error ? error.message : "Falha ao gerar e-mail temporário.");
            await this.requestHuman("unknown_screen", "O mail.tm não gerou a caixa. Confira a integração e clique em Continuar.");
            continue;
          }
        }
        const dialog = this.page?.getByRole("dialog");
        const root = dialog && (await dialog.count()) > 0 ? dialog : this.scope();
        const scope = this.locatorScope(root);
        const filled = await fillPortfolioFields(scope, {
          razao_social: card.razao_social,
          nome: facebook?.nome ?? "",
          sobrenome: facebook?.sobrenome ?? "",
          responsavel: fbName || card.responsavel,
          email_comercial: email,
        });
        if (filled.filled === 0) {
          this.emitLog("warn", "Campos do portfólio não apareceram — clique no card");
          await this.requestHuman("unknown_screen", "Abra o modal do portfólio no AdsPower e clique em Continuar.");
          continue;
        }
        submitted = true;
        this.emitLog("info", this.filledLog(card, filled.keys, fbName, email));
        this.emitLog("info", `Clicando em ${filled.variant === "onboarding" ? "Enviar" : "Criar"} · ${filled.filled} campos preenchidos.`);
        const clicked = await clickCreateButton(scope);
        if (!clicked) this.emitLog("warn", "Botão Criar não apareceu.");
        await sleep(1800);
        await this.waitForDialogGone(4000);
        const afterCreate = await this.snapshot().catch(() => undefined);
        const wizardAfter = afterCreate ? postCreateStep(afterCreate.texts) : undefined;
        if (wizardAfter) {
          const advanced = await this.advancePostCreate(wizardAfter);
          if (advanced && wizardAfter === "confirm") submitted = true;
        }
        continue;
      }
      await this.capture("timeout", "error");
      return "erro";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no worker do farm.";
      this.emitLog("error", message);
      await this.capture("error", "error");
      return "erro";
    } finally {
      await this.release();
    }
  }

  private async advancePostCreate(step: "add_assets" | "add_people" | "confirm"): Promise<boolean> {
    const label =
      step === "confirm" ? "Confirmar o portfólio" : step === "add_people" ? "Adicionar pessoas" : "Adicionar ativos";
    this.emitLog("info", `${label} — clicando em ${step === "confirm" ? "Confirmar" : "Avançar"}.`);
    await this.capture(`portfolio.${step === "confirm" ? "confirm" : step}`);
    const clicked = await clickPostCreateStep(this.locatorScope(this.scope()), step);
    if (!clicked) {
      this.emitLog("warn", `${step === "confirm" ? "Confirmar" : "Avançar"} não apareceu — clique no card`);
      await this.capture(`portfolio.${step}`, "error");
      await this.requestHuman(
        "unknown_screen",
        step === "confirm"
          ? "Clique em Confirmar no resumo do portfólio e depois em Continuar."
          : "Clique em Avançar no assistente do portfólio e depois em Continuar.",
      );
      return false;
    }
    this.emitLog("info", `Cliquei em ${clicked}.`);
    await sleep(800);
    return true;
  }

  private async createDialogOpen(): Promise<boolean> {
    if (!this.page) return false;
    const labeled = this.page
      .getByLabel("Nome do portfólio empresarial", { exact: true })
      .or(this.page.getByLabel("Business portfolio name", { exact: true }))
      .or(this.page.getByLabel("Nome da sua conta e empresa", { exact: true }))
      .or(this.page.getByLabel("Your business and account name", { exact: true }))
      .or(this.page.getByLabel("Seu email comercial", { exact: true }))
      .or(this.page.getByRole("heading", { name: /crie seu portfólio empresarial|create your business portfolio/i }));
    return (await labeled.count()) >= 1;
  }

  private async readPrefillName(): Promise<string> {
    if (!this.page) return "";
    for (const label of ["Seu nome", "Your name"]) {
      const box = this.page.getByLabel(label, { exact: true });
      if ((await box.count()) !== 1) continue;
      const value = (await box.inputValue().catch(() => "")).trim();
      if (value) return value;
    }
    return "";
  }

  private async waitForDialogGone(ms = 4000): Promise<void> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (!(await this.createDialogOpen())) return;
      await sleep(250);
    }
  }

  private async switcherIsOpen(): Promise<boolean> {
    const snap = await this.snapshot().catch(() => undefined);
    return Boolean(snap?.texts.some((line) => /portfólios empresariais|business portfolios/i.test(line)));
  }

  private async openSwitcherPanel(): Promise<boolean> {
    if (!this.page) return false;
    if (await this.switcherIsOpen()) return true;
    this.emitLog("info", "Abrindo o seletor de portfólios…");
    const clicked = await openSwitcher(this.locatorScope(this.page));
    if (!clicked) return false;
    return this.waitForText(/portfólios empresariais|business portfolios/i, 2500);
  }

  private async pageLines(limit = 400): Promise<string[]> {
    if (!this.page) return [];
    const raw = await this.page.locator("body").innerText().catch(() => "");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  private async clickDialogButton(names: string[]): Promise<string | undefined> {
    if (!this.page) return undefined;
    const scope = this.locatorScope(this.scope());
    for (const name of names) {
      const button = scope.getByRole("button", { name, exact: true });
      if ((await button.count()) === 0) continue;
      try {
        await button.first().click({ timeout: 3000 });
        return name;
      } catch {
        try {
          await button.first().click({ timeout: 3000, force: true });
          return name;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  private async readSwitcherNames(): Promise<string[] | undefined> {
    const opened = await this.openSwitcherPanel();
    if (!opened) return undefined;
    await this.capture("portfolio.switcher");
    const texts = await this.pageLines(400);
    const names = extractBusinessPortfolioNames(texts);
    this.emitLog("info", `Seletor · ${names.length} portfólio(s) empresariais.`);
    return names;
  }

  private async readFacebookName(): Promise<{ nome: string; sobrenome: string } | undefined> {
    if (!this.page) return undefined;
    const account = this.page
      .getByRole("button", { name: /sua conta|your account|conta do facebook|facebook account|perfil|profile/i })
      .first();
    if ((await account.count()) > 0) {
      await account.click({ timeout: 4000 }).catch(() => undefined);
    } else {
      const banner = this.page.getByRole("banner");
      const chips = (await banner.count()) > 0 ? banner.getByRole("button") : this.page.getByRole("button");
      const count = await chips.count();
      if (count > 0) {
        await chips.nth(Math.max(0, count - 1)).click({ timeout: 4000 }).catch(() => undefined);
      }
    }
    await sleep(500);
    const headings = (await this.page.getByRole("heading").allTextContents()).map((item) => item.trim());
    for (const heading of headings) {
      const split = splitFacebookName(heading);
      if (split) return split;
    }
    const snap = await this.snapshot().catch(() => undefined);
    for (const line of snap?.texts ?? []) {
      if (/@|portfólio|portfolio|página|instagram|criar|configura|sair|log out/i.test(line)) continue;
      const split = splitFacebookName(line);
      if (split) return split;
    }
    return undefined;
  }

  async requestHuman(reason: HumanPause["reason"], message: string): Promise<void> {
    if (this.stopping) return;
    const pause: HumanPause = {
      id: crypto.randomUUID(),
      empresaId: this.empresaId,
      reason,
      message,
    };
    this.pause = pause;
    this.emit("pause", pause);
    await new Promise<void>((resolve) => {
      this.waiters.set(pause.id, resolve);
    });
  }

  resume(pauseId: string): void {
    const done = this.waiters.get(pauseId);
    this.waiters.delete(pauseId);
    this.pause = null;
    done?.();
  }

  canUseSms(apiConfigured: boolean): boolean {
    return apiConfigured;
  }

  async stop(_config: AdsPowerConfig): Promise<void> {
    this.stopping = true;
    for (const done of this.waiters.values()) done();
    this.waiters.clear();
    this.pause = null;
    await this.release();
  }

  private async release(): Promise<void> {
    const profile = this.profile;
    const logIt = KEEP_ADSPOWER_OPEN_ON_END && shouldLogDetach(profile ?? undefined, this.detached);
    this.detached = true;
    this.page = null;
    this.browser = null;
    this.context = null;
    this.running = false;
    this.openedByUs = false;
    this.profile = null;
    if (logIt) {
      const message = formatFarmDetachLog(profile ?? "");
      this.emitLog("info", message);
      log("info", "adspower", message);
    }
    this.emit("status", this.status());
  }
}

function pageNameFromTexts(texts: string[], title: string): string | undefined {
  const skip = /^(adicione|adicionar|criar|editar|fechar|incomplete|indica|conheça|etapas|ver todas|0 of|seguidores|mais$)/i;
  const found = texts.find((line) => {
    const value = line.trim();
    return value.length >= 3 && value.length <= 48 && !skip.test(value);
  });
  return found ?? (title.trim() || undefined);
}

export function assertSmsConfigured(config: { baseUrl: string; apiKey: string }): void {
  if (!smsReady(config)) {
    throw new Error("SMS só é usado quando URL e API key estão configuradas.");
  }
}
