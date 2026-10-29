import { EventEmitter } from "node:events";
import { clampBatchSize } from "@shared/farm-etapas";
import { canDismissCompany, canDismissFarm, farmNeedsReview } from "@shared/farm-run";
import type { EmpresaCard } from "@shared/empresa";
import type { AdsPowerConfig, FarmCompanyRun, FarmEvent, FarmRunState, HumanPause } from "@shared/types";
import {
  FarmEngine,
  loadPageMap,
  type CreateCompanyInbox,
  type CreateCompanyNumber,
  type PersistCompanyBusinessId,
  type ReadCompanyInbox,
} from "./engine";
import { logError } from "./log";

export class FarmOrchestrator extends EventEmitter {
  private readonly sessions = new Map<string, FarmEngine>();
  private readonly state: FarmRunState = {
    running: false,
    batchSize: 1,
    companies: [],
    mensagem: "Farm ocioso.",
  };
  private stopping = false;

  constructor(
    private readonly repoRoot: string,
    private readonly createCompanyInbox?: CreateCompanyInbox,
    private readonly createCompanyNumber?: CreateCompanyNumber,
    private readonly readCompanyInbox?: ReadCompanyInbox,
    private readonly persistCompanyBusinessId?: PersistCompanyBusinessId,
  ) {
    super();
  }

  getState(): FarmRunState {
    return structuredClone(this.state);
  }

  resume(pauseId: string): FarmRunState {
    for (const [empresaId, engine] of this.sessions) {
      engine.resume(pauseId);
      const company = this.company(empresaId);
      if (company?.pause?.id === pauseId) {
        company.attention = false;
        company.pause = undefined;
        company.status = "running";
        this.pushLog(empresaId, "info", "Continuando…");
      }
    }
    this.emitState();
    return this.getState();
  }

  dismiss(empresaId: string): FarmRunState {
    const company = this.company(empresaId);
    if (!company || !canDismissCompany(company)) return this.getState();
    company.dismissed = true;
    company.attention = false;
    company.pause = undefined;
    this.clearIfReviewDone();
    this.emitState();
    return this.getState();
  }

  dismissAll(): FarmRunState {
    if (!canDismissFarm(this.state)) return this.getState();
    for (const company of this.state.companies) {
      if (canDismissCompany(company)) company.dismissed = true;
    }
    this.clearIfReviewDone();
    this.emitState();
    return this.getState();
  }

  private clearIfReviewDone(): void {
    if (farmNeedsReview(this.state)) return;
    this.state.companies = [];
    this.state.running = false;
    this.state.mensagem = "Farm ocioso.";
  }

  async start(config: { adspower: AdsPowerConfig }, cards: EmpresaCard[], batchSize: number): Promise<FarmRunState> {
    if (this.state.running) throw new Error("Já existe um farm em andamento.");
    if (farmNeedsReview(this.state)) throw new Error("Já existe um farm em revisão. Conclua as abas antes de iniciar outro.");
    this.stopping = false;
    this.state.running = true;
    this.state.batchSize = clampBatchSize(batchSize, cards.length);
    this.state.companies = cards.map((card) => ({
      id: card.id,
      razaoSocial: card.razao_social,
      status: "idle" as const,
      attention: false,
      logs: [],
    }));
    this.state.mensagem = `Farm iniciado · lote ${this.state.batchSize}.`;
    this.emitState();
    void this.runQueue(config.adspower, cards).catch((error) => {
      logError("farm", error, "orquestrador");
      this.state.mensagem = error instanceof Error ? error.message : "Farm interrompido.";
      this.state.running = false;
      this.emitState();
    });
    return this.getState();
  }

  async report(empresaId: string, config: AdsPowerConfig): Promise<FarmRunState> {
    const engine = this.sessions.get(empresaId);
    if (!engine) {
      this.pushLog(empresaId, "warn", "Sem sessão CDP para reportar a tela.");
      return this.getState();
    }
    try {
      const result = await engine.captureForOperator();
      this.pushLog(empresaId, "error", `Tela reportada · ${result.dir ?? result.fingerprint}`);
    } catch (error) {
      this.pushLog(empresaId, "error", error instanceof Error ? error.message : "Falha ao capturar a tela.");
    }
    await engine.stop(config);
    this.sessions.delete(empresaId);
    const company = this.company(empresaId);
    if (company) {
      company.status = "erro";
      company.attention = false;
      company.pause = undefined;
    }
    this.emitState();
    return this.getState();
  }

  async stop(config: AdsPowerConfig): Promise<FarmRunState> {
    this.stopping = true;
    this.state.mensagem = "Encerrando farm…";
    this.emitState();
    await Promise.allSettled([...this.sessions.values()].map((engine) => engine.stop(config)));
    this.sessions.clear();
    for (const company of this.state.companies) {
      if (company.status === "running" || company.status === "paused" || company.status === "idle") {
        company.status = "erro";
        company.attention = false;
      }
    }
    this.state.running = false;
    this.state.mensagem = "Farm encerrado.";
    this.emitState();
    return this.getState();
  }

  private company(id: string): FarmCompanyRun | undefined {
    return this.state.companies.find((item) => item.id === id);
  }

  private pushLog(empresaId: string | undefined, level: FarmEvent["level"], message: string): void {
    const event: FarmEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      empresaId,
      level,
      message,
    };
    if (empresaId) {
      const company = this.company(empresaId);
      company?.logs.push(event);
    }
    this.emit("event", event);
    this.emitState();
  }

  private emitState(): void {
    this.emit("state", this.getState());
  }

  private attach(engine: FarmEngine, card: EmpresaCard): void {
    engine.on("log", (event: FarmEvent) => {
      const company = this.company(card.id);
      if (company) company.logs.push(event);
      this.emit("event", event);
      this.emitState();
    });
    engine.on("pause", (pause: HumanPause) => {
      const company = this.company(card.id);
      if (company) {
        company.status = "paused";
        company.attention = true;
        company.pause = pause;
      }
      this.emit("pause", pause);
      this.emitState();
    });
  }

  private async runOne(config: AdsPowerConfig, card: EmpresaCard): Promise<void> {
    if (this.stopping) return;
    const company = this.company(card.id);
    if (company) {
      company.status = "running";
      company.attention = false;
    }
    const engine = new FarmEngine(
      this.repoRoot,
      loadPageMap(this.repoRoot),
      this.createCompanyInbox,
      this.createCompanyNumber,
      this.readCompanyInbox,
      this.persistCompanyBusinessId,
    );
    this.sessions.set(card.id, engine);
    this.attach(engine, card);
    let result: "ok" | "paused" | "erro" = "erro";
    try {
      result = await engine.runPortfolio(config, card);
      if (result === "ok" && !this.stopping) {
        result = await engine.runEmpresa(config, card);
      }
      if (result === "ok" && !this.stopping) {
        result = await engine.runEmailConfirm(config, card);
      }
    } finally {
      this.sessions.delete(card.id);
      await engine.release();
    }
    if (!company) return;
    if (result === "ok") {
      company.status = "ok";
      company.attention = false;
      company.pause = undefined;
    } else if (result === "paused") {
      company.status = "paused";
      company.attention = true;
    } else {
      company.status = "erro";
      company.attention = false;
    }
    this.emit("company", { card, result });
    this.emitState();
  }

  private async runQueue(config: AdsPowerConfig, cards: EmpresaCard[]): Promise<void> {
    const queue = [...cards];
    const workers = Math.min(this.state.batchSize, queue.length);
    const launch = async (): Promise<void> => {
      const card = queue.shift();
      if (!card || this.stopping) return;
      await this.runOne(config, card);
      await launch();
    };
    await Promise.all(Array.from({ length: workers }, () => launch()));
    this.state.running = false;
    this.state.mensagem = this.stopping ? "Farm encerrado." : "Farm concluído nesta fase (portfólio, empresa e e-mail).";
    this.emitState();
  }
}
