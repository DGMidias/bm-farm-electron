import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { joinPath } from "@harness/compat";
import { attemptAutomaticCaptcha, captchaNeedsHuman } from "@shared/captcha";
import { FIELDS_FOR, type EmpresaCard } from "@shared/empresa";
import {
  clickSaveEmpresa,
  empresaDetailsEmpty,
  empresaDetailsFormVisible,
  empresaEtapaConcluida,
  empresaPageMatchesCard,
  empresaSaveFailed,
  empresaSaveSucceeded,
  fillEmpresaDetails,
  isEmpresaDetailsForm,
  openEmpresaDetailsModal,
  selectEmpresaCountry,
} from "@shared/empresa-fill";
import {
  FARM_ETAPAS,
  businessIdForEmpresa,
  businessUsersSettingsUrl,
  EMAIL_CONFIRM_EMPTY_POLLS,
  EMAIL_CONFIRM_POLL_MS,
  empresaChromeBlocksEdit,
  etapaHref,
  isDuplicatePortfolioError,
  mergePortfolioChrome,
  portfolioConfirmedOnSettings,
  portfolioNeedsSwitcher,
  portfolioResumeAction,
  portfolioIsCurrent,
  portfolioListed,
  portfolioListedAction,
  PORTFOLIO_URL,
  shouldGenerateEmpresaPhone,
  shouldGeneratePortfolioInbox,
  shouldRedirectToBusinessUsers,
  SKIP_COMPLETED_ETAPA,
  withBusinessId,
} from "@shared/farm-etapas";
import {
  businessIdFromUrl,
  formatEmailConfirmLog,
  formatEmpresaFilledLog,
  formatEtapaSkippedLog,
  formatFarmDetachLog,
  formatNotLoggedInLog,
  formatPortfolioCreatedLog,
  formatPortfolioFilledLog,
  formatPortfolioRedirectLog,
  formatSuiteUnavailableRedirectLog,
  formatTempEmailLog,
  formatVirtualPhoneLog,
  KEEP_ADSPOWER_OPEN_ON_END,
  shouldLogDetach,
} from "@shared/farm-log";
import { confirmationLinkFromInbox, emailConfirmEtapaConcluida, emailConfirmPendingOnSettings } from "@shared/mail-view";
import { detectScreen, type PageMap } from "@shared/map";
import { metaNeedsLogin } from "@shared/meta-session";
import {
  adsPolicyButtonNames,
  clickAdsPolicy,
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
import { pickAdsPowerTabIndex, shouldReuseAdsPowerTab } from "@shared/adspower-view";
import type { AdsPowerConfig, EngineStatus, FarmEvent, HumanPause, ScreenSnapshot } from "@shared/types";
import { isProfileActive, startProfile } from "./adspower";
import { log, logError } from "./log";
import type { CaptureReason } from "@shared/page-capture";
import { savePageCapture, snapshotFromPage } from "./page-capture";
import { smsReady } from "./sms";

export type CreateCompanyInbox = (
  card: Pick<EmpresaCard, "id" | "razao_social" | "adspower_profile">,
) => Promise<{ address: string }>;

export type CreateCompanyNumber = (
  card: Pick<EmpresaCard, "id" | "razao_social" | "adspower_profile">,
) => Promise<{ phone: string }>;

export type ReadCompanyInbox = (
  card: Pick<EmpresaCard, "id" | "email_comercial" | "razao_social" | "adspower_profile">,
) => Promise<{ address: string; messages: Array<{ id: string; link?: string }> }>;

export type PersistCompanyBusinessId = (
  card: Pick<EmpresaCard, "id"> & { business_id?: string },
) => void | Promise<void>;

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
  private lastBusinessId?: string;

  constructor(
    private readonly repoRoot: string,
    private readonly map: PageMap,
    private readonly createCompanyInbox?: CreateCompanyInbox,
    private readonly createCompanyNumber?: CreateCompanyNumber,
    private readonly readCompanyInbox?: ReadCompanyInbox,
    private readonly persistCompanyBusinessId?: PersistCompanyBusinessId,
  ) {
    super();
  }

  private beginCard(card: EmpresaCard): void {
    if (this.empresaId !== card.id) this.lastBusinessId = undefined;
    this.empresaId = card.id;
    this.stopping = false;
    this.detached = false;
  }

  private async persistRememberedBusinessId(card: EmpresaCard): Promise<void> {
    if (!this.persistCompanyBusinessId) return;
    await this.persistCompanyBusinessId({ id: card.id, business_id: card.business_id?.trim() ?? "" });
  }

  private dropStoredBusinessId(card: EmpresaCard): void {
    if (!card.business_id && !this.lastBusinessId) return;
    card.business_id = undefined;
    this.lastBusinessId = undefined;
    void this.persistRememberedBusinessId(card);
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
    if (!profileId.trim()) throw new Error("Informe o perfil AdsPower (user_id ou serial).");
    const id = profileId.trim();
    if (shouldReuseAdsPowerTab({ running: this.running, profile: this.profile, target: id }) && this.page) {
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
    if (this.running) throw new Error("Já existe uma sessão. Encerre antes de abrir outra.");
    const wasActive = await isProfileActive(config, id);
    this.emitLog("info", `Abrindo perfil ${id}…`);
    const ws = await startProfile(config, id);
    this.openedByUs = !wasActive;
    this.browser = await chromium.connectOverCDP(ws);
    this.context = this.browser.contexts()[0] ?? (await this.browser.newContext());
    const pages = this.context.pages();
    const index = pickAdsPowerTabIndex(
      pages.map((item) => {
        try {
          return item.url();
        } catch {
          return "";
        }
      }),
      openUrl,
    );
    if (index >= 0) {
      this.page = pages[index] ?? null;
      this.emitLog("info", "Reusando aba…");
    } else {
      this.page = await this.context.newPage();
      this.emitLog("info", "Aba nova…");
    }
    this.profile = id;
    this.running = true;
    if (openUrl && this.page) {
      await this.page.goto(openUrl, { waitUntil: "domcontentloaded" });
    }
    const url = this.page?.url() ?? "";
    const title = this.page ? await this.page.title() : "";
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
        root.getByRole(role as "button" | "link" | "combobox" | "menuitem" | "option" | "listbox", options),
      fillSearch: async (value: string) => {
        if (!this.page) return;
        const inList = this.page.getByRole("listbox").getByRole("combobox");
        if ((await inList.count()) >= 1) {
          await inList.first().fill(value);
        } else {
          await this.page.keyboard.type(value, { delay: 40 });
        }
        await this.page
          .getByRole("option", { name: value })
          .first()
          .waitFor({ state: "visible", timeout: 4000 })
          .catch(() => undefined);
      },
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

  private rememberBusinessId(
    url: string,
    card?: EmpresaCard,
    options: { texts?: string[]; trusted?: boolean } = {},
  ): string | undefined {
    const id = businessIdFromUrl(url);
    if (!id) return this.lastBusinessId;
    const texts = options.texts ?? [];
    const ours = Boolean(options.trusted || (card && texts.length && empresaPageMatchesCard(texts, card.razao_social)));
    if (!ours) return this.lastBusinessId;
    this.lastBusinessId = id;
    if (card) {
      card.business_id = id;
      void this.persistRememberedBusinessId(card);
    }
    return id;
  }

  private async handleCaptcha(): Promise<void> {
    this.emitLog("info", "Tentando CAPTCHA automático…");
    const passed = await attemptAutomaticCaptcha();
    if (!captchaNeedsHuman(passed)) {
      this.emitLog("info", "CAPTCHA automático passou.");
      return;
    }
    this.emitLog("warn", "CAPTCHA automático falhou — clique no card");
    await this.requestHuman("captcha", "Resolva o CAPTCHA no Chromium do AdsPower e clique em Continuar.");
  }

  async runPortfolio(config: AdsPowerConfig, card: EmpresaCard): Promise<"ok" | "paused" | "erro"> {
    this.beginCard(card);
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
        this.rememberBusinessId(url, card, { texts: snapshot.texts, trusted: submitted });
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
        if (!formOpen && adsPolicyButtonNames(snapshot.texts)) {
          const policyClicked = await clickAdsPolicy(this.locatorScope(this.page), snapshot.texts);
          if (policyClicked) {
            this.emitLog("info", `Política de anúncios da Meta — cliquei em ${policyClicked}.`);
            await sleep(1200);
            continue;
          }
          this.emitLog("warn", "Política de anúncios visível, mas o botão não clicou — clique no card");
          await this.requestHuman(
            "unknown_screen",
            "Aceite a política de anúncios no AdsPower (Aceito, depois Concluir) e clique em Continuar.",
          );
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
          await this.handleCaptcha();
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
        const fullTexts = await this.pageChrome(400);
        if (isDuplicatePortfolioError(fullTexts)) {
          this.rememberBusinessId(url, card, { trusted: true });
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
          this.rememberBusinessId(redirect, card, { trusted: submitted });
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
          if (
            portfolioConfirmedOnSettings({
              url: this.page?.url() ?? url,
              texts: fullTexts,
              razaoSocial: card.razao_social,
              submitted,
            })
          ) {
            this.rememberBusinessId(this.page?.url() ?? url, card, { texts: fullTexts, trusted: true });
            await this.persistRememberedBusinessId(card);
            this.emitLog("info", this.createdLog(card, this.page?.url() ?? url, fbName || card.responsavel, email));
            return "ok";
          }
          const pageUrl = this.page?.url() ?? url;
          const chromeMismatch = empresaChromeBlocksEdit(fullTexts, card.razao_social);
          if (chromeMismatch) this.dropStoredBusinessId(card);
          const alreadyCurrent = portfolioIsCurrent({
            url: pageUrl,
            texts: fullTexts,
            razaoSocial: card.razao_social,
            storedId: card.business_id,
          });
          const stored = card.business_id?.trim();
          if (!alreadyCurrent && stored && businessIdFromUrl(pageUrl) === stored && !portfolioListed(fullTexts, card.razao_social)) {
            this.dropStoredBusinessId(card);
          }
          const resume = portfolioResumeAction({
            current: alreadyCurrent,
            storedId: card.business_id,
            chromeMismatch,
          });
          if (resume === "skip" && (submitted || SKIP_COMPLETED_ETAPA)) {
            this.rememberBusinessId(pageUrl, card, { texts: fullTexts, trusted: submitted });
            await this.persistRememberedBusinessId(card);
            this.emitLog(
              "info",
              submitted
                ? this.createdLog(card, pageUrl, fbName || card.responsavel, email)
                : formatEtapaSkippedLog({ etapa: "portfolio", pageName: card.razao_social, url: pageUrl }),
            );
            return "ok";
          }
          if (resume === "goto" && card.business_id && this.page) {
            this.emitLog("info", `Portfólio já tem business_id · abrindo ${card.business_id}`);
            await this.page.goto(businessUsersSettingsUrl(card.business_id), { waitUntil: "domcontentloaded" });
            continue;
          }
          if (
            !portfolioNeedsSwitcher({
              submitted,
              confirmed: false,
              url: pageUrl,
            })
          ) {
            continue;
          }
          const names = await this.readSwitcherNames();
          if (!names) {
            this.emitLog("warn", "Seletor de portfólios não abriu — clique no card");
            await this.capture("portfolio.switcher", "error");
            await this.requestHuman("unknown_screen", "Abra o seletor no canto superior esquerdo e clique em Continuar.");
            continue;
          }
          const listed = portfolioListed(names, card.razao_social);
          const current = portfolioIsCurrent({
            url: pageUrl,
            texts: fullTexts,
            razaoSocial: card.razao_social,
            storedId: card.business_id,
          });
          const action = portfolioListedAction({ listed, current, storedId: card.business_id });
          if (action === "skip") {
            this.rememberBusinessId(pageUrl, card, { texts: fullTexts });
            await this.persistRememberedBusinessId(card);
            if (submitted) {
              this.emitLog("info", this.createdLog(card, pageUrl, fbName || card.responsavel, email));
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
          if (action === "goto" && card.business_id && this.page) {
            this.emitLog("info", `Razão na lista · abrindo business_id=${card.business_id}`);
            await this.page.goto(businessUsersSettingsUrl(card.business_id), { waitUntil: "domcontentloaded" });
            continue;
          }
          if (action === "pause") {
            this.emitLog("warn", "A razão está no seletor, mas este chrome é de outro portfólio — clique no card");
            await this.capture("portfolio.switcher", "error");
            await this.requestHuman(
              "unknown_screen",
              "A razão está no seletor. Selecione esse portfólio e clique em Continuar.",
            );
            continue;
          }
          if (submitted) {
            this.emitLog("warn", "A razão não apareceu no seletor — clique no card");
            await this.capture("portfolio.switcher", "error");
            await this.requestHuman("unknown_screen", "Confira se o portfólio entrou na lista e clique em Continuar.");
            continue;
          }
          this.dropStoredBusinessId(card);
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
            await this.requestHuman("unknown_screen", "A 22.do não gerou a caixa. Confira URL e token e clique em Continuar.");
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
    }
  }

  async runEmpresa(config: AdsPowerConfig, card: EmpresaCard): Promise<"ok" | "paused" | "erro"> {
    this.beginCard(card);
    const businessId = businessIdForEmpresa({ sessionId: this.lastBusinessId, storedId: card.business_id });
    let mintedPhone = false;
    const etapa = FARM_ETAPAS.find((item) => item.id === "empresa");
    const openUrl = (etapa ? etapaHref(etapa, businessId) : undefined) ?? etapa?.url;
    if (!openUrl) return "erro";
    try {
      await this.startProfile(config, card.adspower_profile, openUrl);
      if (this.page && businessId) {
        const landed = businessIdFromUrl(this.page.url());
        if (landed && landed !== businessId) {
          this.emitLog("info", `Settings apontavam para outro BM · indo para business_id=${businessId}`);
          await this.page.goto(openUrl, { waitUntil: "domcontentloaded" });
        }
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (this.stopping) return "erro";
        await sleep(800);
        const snapshot = await this.snapshot();
        const url = this.page?.url() ?? snapshot.url;
        this.rememberBusinessId(url, card, { texts: snapshot.texts });
        if (metaNeedsLogin({ url, texts: snapshot.texts })) {
          await this.capture("login");
          this.emitLog("warn", formatNotLoggedInLog(this.profile ?? card.adspower_profile));
          await this.requestHuman(
            "login",
            "Este perfil AdsPower não está logado na Meta. Faça login no Chromium do AdsPower e clique em Continuar.",
          );
          continue;
        }
        const node = detectScreen(this.map, snapshot);
        if (node.id === "checkpoint.captcha" || node.human === "captcha") {
          await this.handleCaptcha();
          continue;
        }
        if (node.id === "empresa.info" || node.id === "empresa.details_form" || node.id === "unknown") {
          await this.capture(node.id);
        }
        const fullTexts = await this.pageLines(400);
        if (empresaChromeBlocksEdit(fullTexts, card.razao_social)) {
          const targetId = businessIdForEmpresa({ sessionId: this.lastBusinessId, storedId: card.business_id });
          const landed = businessIdFromUrl(url);
          if (targetId && this.page && landed !== targetId) {
            this.emitLog("info", `Settings apontavam para outro BM · indo para business_id=${targetId}`);
            await this.page.goto(withBusinessId(openUrl, targetId), { waitUntil: "domcontentloaded" });
            continue;
          }
          this.emitLog("warn", `Chrome de outro portfólio · ${card.razao_social} — clique no card`);
          await this.capture("empresa.info", "error");
          await this.requestHuman(
            "unknown_screen",
            "Este chrome é de outro portfólio. Selecione o da empresa e clique em Continuar.",
          );
          continue;
        }
        if (
          SKIP_COMPLETED_ETAPA &&
          empresaEtapaConcluida({
            texts: fullTexts,
            razaoSocial: card.razao_social,
            endereco: card.endereco,
          })
        ) {
          this.emitLog(
            "info",
            formatEtapaSkippedLog({ etapa: "empresa", pageName: card.razao_social, url: this.page?.url() }),
          );
          return "ok";
        }
        const formOpen = (await this.empresaDialogOpen()) || isEmpresaDetailsForm(fullTexts);
        if (formOpen) {
          const dialog = this.page?.getByRole("dialog");
          const root = dialog && (await dialog.count()) > 0 ? dialog : this.scope();
          const scope = this.locatorScope(root);
          const pageScope = this.locatorScope(this.scope());
          if (shouldGenerateEmpresaPhone(card) && !mintedPhone) {
            if (!this.createCompanyNumber) {
              this.emitLog("error", "Sem gerador de número virtual.");
              return "erro";
            }
            try {
              const created = await this.createCompanyNumber(card);
              card.telefone = created.phone;
              mintedPhone = true;
              this.emitLog(
                "info",
                formatVirtualPhoneLog({
                  phone: created.phone,
                  razaoSocial: card.razao_social,
                  profile: card.adspower_profile,
                }),
              );
            } catch (error) {
              this.emitLog("error", error instanceof Error ? error.message : "Falha ao gerar número virtual.");
              await this.requestHuman(
                "unknown_screen",
                "O Número Virtual não gerou a linha. Confira URL e API key e clique em Continuar.",
              );
              continue;
            }
          }
          const filled = await fillEmpresaDetails(scope, card);
          const country = await selectEmpresaCountry(scope, pageScope);
          if (filled.filled === 0) {
            this.emitLog("warn", "Campos da empresa não apareceram — clique no card");
            await this.requestHuman("unknown_screen", "Abra o modal Detalhes da empresa no AdsPower e clique em Continuar.");
            continue;
          }
          if (!country) {
            this.emitLog("warn", "País Brasil não selecionou — clique no card");
            await this.requestHuman(
              "unknown_screen",
              "Selecione Brasil no campo País do modal e clique em Continuar.",
            );
            continue;
          }
          this.emitLog(
            "info",
            formatEmpresaFilledLog({
              razaoSocial: card.razao_social,
              businessId: businessIdForEmpresa({ sessionId: this.lastBusinessId, storedId: card.business_id }),
              keys: [...filled.keys, "pais"],
            }),
          );
          const saved = await clickSaveEmpresa(scope);
          if (!saved) {
            this.emitLog("warn", "Salvar não apareceu — clique no card");
            await this.requestHuman("unknown_screen", "Clique em Salvar no modal da empresa e depois em Continuar.");
            continue;
          }
          this.emitLog("info", `Cliquei em ${saved}.`);
          await sleep(1500);
          const afterSave = await this.pageLines(400);
          if (empresaSaveFailed(afterSave)) {
            this.emitLog("warn", "Meta recusou o salvar da empresa — clique no card");
            await this.requestHuman(
              "unknown_screen",
              "A Meta não salvou os detalhes (consulta ou país). Confira País = Brasil e clique em Salvar, depois em Continuar.",
            );
            continue;
          }
          this.emitLog(
            "info",
            empresaSaveSucceeded(afterSave)
              ? `Detalhes da empresa salvos · ${card.razao_social}`
              : `Salvei os detalhes da empresa · ${card.razao_social}`,
          );
          return "ok";
        }
        if (empresaDetailsEmpty(fullTexts) || node.id === "empresa.info") {
          const opened = await this.openEmpresaDetails();
          if (!opened) {
            this.emitLog("warn", "Editar detalhes da empresa não abriu — clique no card");
            await this.requestHuman(
              "unknown_screen",
              "Clique em Editar em Detalhes da empresa no AdsPower e depois em Continuar.",
            );
            continue;
          }
          this.emitLog("info", "Abrindo Detalhes da empresa…");
          continue;
        }
        this.emitLog("warn", "Tela da empresa não reconhecida — clique no card");
        await this.requestHuman("unknown_screen", "Abra Informações da empresa no AdsPower e clique em Continuar.");
      }
      await this.capture("timeout", "error");
      return "erro";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na etapa da empresa.";
      this.emitLog("error", message);
      await this.capture("error", "error");
      return "erro";
    }
  }

  private emailSettingsUrl(card: EmpresaCard): string | undefined {
    const etapa = FARM_ETAPAS.find((item) => item.id === "empresa");
    const businessId = businessIdForEmpresa({ sessionId: this.lastBusinessId, storedId: card.business_id });
    return (etapa ? etapaHref(etapa, businessId) : undefined) ?? etapa?.url;
  }

  async runEmailConfirm(config: AdsPowerConfig, card: EmpresaCard): Promise<"ok" | "paused" | "erro"> {
    this.beginCard(card);
    const settingsUrl = this.emailSettingsUrl(card);
    try {
      await this.startProfile(config, card.adspower_profile, settingsUrl);
      let emptyPolls = 0;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (this.stopping) return "erro";
        await sleep(800);
        const snapshot = await this.snapshot();
        const url = this.page?.url() ?? snapshot.url;
        if (metaNeedsLogin({ url, texts: snapshot.texts })) {
          await this.capture("login");
          this.emitLog("warn", formatNotLoggedInLog(this.profile ?? card.adspower_profile));
          await this.requestHuman(
            "login",
            "Este perfil AdsPower não está logado na Meta. Faça login no Chromium do AdsPower e clique em Continuar.",
          );
          continue;
        }
        const node = detectScreen(this.map, snapshot);
        if (node.id === "checkpoint.captcha" || node.human === "captcha") {
          await this.handleCaptcha();
          continue;
        }
        const fullTexts = await this.pageLines(400);
        if (emailConfirmEtapaConcluida({ url, texts: fullTexts })) {
          this.emitLog(
            "info",
            formatEtapaSkippedLog({ etapa: "email_confirm", pageName: card.razao_social, url }),
          );
          return "ok";
        }
        if (this.page && settingsUrl && !/\/latest\/settings\/business_info/i.test(url)) {
          await this.page.goto(settingsUrl, { waitUntil: "domcontentloaded" });
          continue;
        }
        if (!emailConfirmPendingOnSettings(fullTexts)) {
          await sleep(EMAIL_CONFIRM_POLL_MS);
          continue;
        }
        if (!this.readCompanyInbox) {
          this.emitLog("error", "Sem leitor da caixa 22.do.");
          return "erro";
        }
        let inbox;
        try {
          inbox = await this.readCompanyInbox(card);
        } catch (error) {
          emptyPolls += 1;
          this.emitLog("error", error instanceof Error ? error.message : "Falha ao ler a caixa 22.do.");
          if (emptyPolls >= EMAIL_CONFIRM_EMPTY_POLLS) break;
          await sleep(EMAIL_CONFIRM_POLL_MS);
          continue;
        }
        const link = confirmationLinkFromInbox(inbox);
        if (!link) {
          emptyPolls += 1;
          this.emitLog(
            "info",
            `Caixa ${inbox.address} · ${inbox.messages.length} mensagem(ns) · sem link de confirmação ainda`,
          );
          if (emptyPolls >= EMAIL_CONFIRM_EMPTY_POLLS) break;
          await sleep(EMAIL_CONFIRM_POLL_MS);
          continue;
        }
        this.emitLog(
          "info",
          formatEmailConfirmLog({
            address: inbox.address,
            url: link,
            razaoSocial: card.razao_social,
            profile: card.adspower_profile,
          }),
        );
        await this.page?.goto(link, { waitUntil: "domcontentloaded" });
        await sleep(1500);
        const afterUrl = this.page?.url() ?? "";
        const after = await this.pageLines(400);
        if (metaNeedsLogin({ url: afterUrl, texts: after })) {
          await this.capture("login");
          this.emitLog("warn", formatNotLoggedInLog(this.profile ?? card.adspower_profile));
          await this.requestHuman(
            "login",
            "O link de confirmação pediu login. Entre no AdsPower e clique em Continuar.",
          );
          continue;
        }
        if (/verify\/email|confirmemail|confirm[_-]?email|email\/confirm|email\/checkpoint/i.test(afterUrl)) {
          const clicked = await this.clickEmailConfirmAction();
          if (clicked) this.emitLog("info", `Cliquei em ${clicked}.`);
          await sleep(800);
        }
        if (settingsUrl && this.page) {
          await this.page.goto(settingsUrl, { waitUntil: "domcontentloaded" });
        }
      }
      this.emitLog("error", `E-mail ainda pendente · ${card.razao_social}`);
      await this.capture("timeout", "error");
      return "erro";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao confirmar o e-mail.";
      this.emitLog("error", message);
      await this.capture("error", "error");
      return "erro";
    }
  }

  private async clickEmailConfirmAction(): Promise<string | undefined> {
    const names = ["Confirmar e-mail", "Confirm email", "Confirmar", "Confirm", "Verify", "Verificar"];
    const clicked = await this.clickDialogButton(names);
    if (clicked) return clicked;
    if (!this.page) return undefined;
    for (const name of names) {
      const link = this.page.getByRole("link", { name, exact: true });
      if ((await link.count()) === 0) continue;
      try {
        await link.first().click({ timeout: 3000 });
        return name;
      } catch {
        try {
          await link.first().click({ timeout: 3000, force: true });
          return name;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  private async empresaDialogOpen(): Promise<boolean> {
    if (!this.page) return false;
    const dialog = this.page.getByRole("dialog");
    const root = (await dialog.count()) > 0 ? dialog : this.page;
    return empresaDetailsFormVisible(this.locatorScope(root));
  }

  private async waitForEmpresaDialog(ms = 5000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.stopping || !this.page) return false;
      if (await this.empresaDialogOpen()) return true;
      await sleep(250);
    }
    return false;
  }

  private async openEmpresaDetails(): Promise<boolean> {
    if (!this.page) return false;
    if (await this.empresaDialogOpen()) return true;
    const heading = this.page.getByText(/^Detalhes da empresa$|^Business details$/i).first();
    if ((await heading.count()) > 0) {
      const edit = heading.locator('xpath=following::button[normalize-space()="Editar" or normalize-space()="Edit"][1]');
      if ((await edit.count()) > 0) {
        try {
          await edit.click({ timeout: 4000 });
        } catch {
          await edit.click({ timeout: 4000, force: true }).catch(() => undefined);
        }
        if (await this.waitForEmpresaDialog(5000)) return true;
      }
    }
    const evaluated = await this.page
      .evaluate(() => {
        const heading = [...document.querySelectorAll("h1,h2,h3,h4,span,div")].find((el) =>
          /^(detalhes da empresa|business details)$/i.test((el.textContent || "").trim()),
        );
        if (!heading) return false;
        const buttons = [...document.querySelectorAll("button, [role=button]")];
        const after = buttons.find((el) => {
          if (!/^(editar|edit)$/i.test((el.textContent || "").trim())) return false;
          const pos = heading.compareDocumentPosition(el);
          return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        });
        if (!after || !(after instanceof HTMLElement)) return false;
        after.click();
        return true;
      })
      .catch(() => false);
    if (evaluated && (await this.waitForEmpresaDialog(5000))) return true;
    const fallback = await openEmpresaDetailsModal(this.locatorScope(this.scope()));
    if (!fallback) return false;
    return this.waitForEmpresaDialog(5000);
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
    if (step === "confirm") await this.waitForLatestSettings(5000);
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

  private async waitForLatestSettings(ms = 5000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.stopping || !this.page) return false;
      const url = this.page.url();
      if (/\/latest\/settings\//i.test(url) && businessIdFromUrl(url)) return true;
      await sleep(250);
    }
    return false;
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

  private async pageChrome(limit = 400): Promise<string[]> {
    const lines = await this.pageLines(limit);
    if (!this.page) return lines;
    const headings = await this.page.getByRole("heading").allTextContents().catch(() => []);
    const toolbars = await this.page.getByRole("toolbar").allTextContents().catch(() => []);
    return mergePortfolioChrome(lines, [...headings, ...toolbars]).slice(0, limit);
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

  async release(): Promise<void> {
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
