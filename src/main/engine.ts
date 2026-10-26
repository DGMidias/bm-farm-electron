import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { joinPath } from "@harness/compat";
import { FIELDS_FOR, type EmpresaCard } from "@shared/empresa";
import { detectScreen, type PageMap } from "@shared/map";
import type { AdsPowerConfig, EngineStatus, HumanPause, ScreenSnapshot } from "@shared/types";
import { startProfile, stopProfile } from "./adspower";
import { smsReady } from "./sms";

export function loadPageMap(repoRoot: string): PageMap {
  const file = joinPath(repoRoot, "mapas", "meta-bm.v1.json");
  return JSON.parse(readFileSync(file, "utf8")) as PageMap;
}

export class FarmEngine extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private profile: string | null = null;
  private pause: HumanPause | null = null;
  private running = false;
  private waiters = new Map<string, () => void>();

  constructor(
    private readonly repoRoot: string,
    private readonly map: PageMap,
  ) {
    super();
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

  async start(config: AdsPowerConfig, card: EmpresaCard): Promise<EngineStatus> {
    if (this.running) throw new Error("Já existe uma sessão. Encerre antes de abrir outra.");
    if (!card.adspower_profile.trim()) throw new Error("Selecione o perfil AdsPower do card.");
    const ws = await startProfile(config, card.adspower_profile.trim());
    this.browser = await chromium.connectOverCDP(ws);
    this.context = this.browser.contexts()[0] ?? await this.browser.newContext();
    this.page = this.context.pages()[0] ?? await this.context.newPage();
    this.profile = card.adspower_profile.trim();
    this.running = true;
    this.emit("status", this.status());
    return this.status();
  }

  async snapshot(): Promise<ScreenSnapshot> {
    if (!this.page) throw new Error("Nenhuma sessão Playwright/CDP.");
    const texts = await this.page.locator("body").innerText();
    return {
      url: this.page.url(),
      title: await this.page.title(),
      texts: texts.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 80),
      roles: [],
    };
  }

  async detect(): Promise<{ nodeId: string; snapshot: ScreenSnapshot; human?: HumanPause["reason"] }> {
    const snapshot = await this.snapshot();
    const node = detectScreen(this.map, snapshot);
    if (node.human) {
      this.pause = {
        id: crypto.randomUUID(),
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

  async requestHuman(reason: HumanPause["reason"], message: string): Promise<void> {
    const pause: HumanPause = { id: crypto.randomUUID(), reason, message };
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

  async stop(config: AdsPowerConfig): Promise<void> {
    const profile = this.profile;
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.running = false;
    if (profile) {
      try {
        await stopProfile(config, profile);
      } catch {
        /* operator can close in AdsPower */
      }
    }
    this.profile = null;
    this.emit("status", this.status());
  }
}

export function assertSmsConfigured(config: { baseUrl: string; apiKey: string }): void {
  if (!smsReady(config)) {
    throw new Error("SMS só é usado quando URL e API key estão configuradas.");
  }
}
