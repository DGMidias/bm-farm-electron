import { canDismissCompany, canDismissFarm, visibleFarmCompanies } from "@shared/farm-run";
import type { FarmCompanyRun, FarmRunState } from "@shared/types";

interface Props {
  state: FarmRunState;
  selectedId?: string;
  onSelect: (id: string) => void;
  onStop: () => Promise<void>;
  onResume: (pauseId: string) => Promise<void>;
  onReport: (empresaId: string) => Promise<void>;
  onDismiss: (empresaId: string) => Promise<void>;
  onDismissAll: () => Promise<void>;
}

function statusLabel(company: FarmCompanyRun): string {
  if (company.status === "ok") return "ok";
  if (company.status === "erro") return "erro";
  if (company.status === "paused") return "pausa";
  if (company.status === "running") return "rodando";
  return "fila";
}

export function FarmRunPage({ state, selectedId, onSelect, onStop, onResume, onReport, onDismiss, onDismissAll }: Props) {
  const visible = visibleFarmCompanies(state);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const canReport = selected?.status === "running" || selected?.status === "paused";
  const aborting = visible.some((item) => item.status === "running" || item.status === "paused" || item.status === "idle");
  const canConcludeSelected = Boolean(selected && canDismissCompany(selected));
  return (
    <section className="page farm-run">
      <h1>{state.running ? "Farm em andamento" : "Farm em revisão"}</h1>
      <p className="muted">{state.mensagem} Lote {state.batchSize}.</p>
      {aborting || canDismissFarm(state) ? (
        <div className="row">
          {aborting ? (
            <button className="btn ghost" type="button" onClick={() => void onStop()}>
              Encerrar farm
            </button>
          ) : null}
          {canDismissFarm(state) ? (
            <button className="btn" type="button" onClick={() => void onDismissAll()}>
              Concluir farm
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="farm-tabs" role="tablist">
        {visible.map((company) => (
          <button
            key={company.id}
            type="button"
            role="tab"
            aria-selected={company.id === selected?.id}
            className={`farm-tab${company.id === selected?.id ? " active" : ""}`}
            onClick={() => onSelect(company.id)}
          >
            {company.status === "ok" ? (
              <span className="done" aria-label="concluída">
                ✓
              </span>
            ) : null}
            {company.attention ? (
              <span className="attention" aria-label="atenção">
                !
              </span>
            ) : null}
            <span>{company.razaoSocial || company.id}</span>
            <span className="muted">{statusLabel(company)}</span>
          </button>
        ))}
      </div>
      {selected?.pause ? <div className="status err">{selected.pause.message}</div> : null}
      {selected && (canReport || canConcludeSelected || selected.pause) ? (
        <div className="row farm-tab-actions" aria-label={`Ações de ${selected.razaoSocial || selected.id}`}>
          {canReport ? (
            <button className="btn ghost" type="button" onClick={() => void onReport(selected.id)}>
              Reportar tela
            </button>
          ) : null}
          {selected.pause ? (
            <button className="btn" type="button" onClick={() => void onResume(selected.pause!.id)}>
              Continuar
            </button>
          ) : null}
          {canConcludeSelected ? (
            <button className="btn" type="button" onClick={() => void onDismiss(selected.id)}>
              Concluir {selected.razaoSocial || selected.id}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="farm-log" aria-live="polite">
        {(selected?.logs ?? []).map((line) => (
          <div key={line.id} className={`log-line ${line.level}`}>
            {line.message}
          </div>
        ))}
        {selected && !selected.logs.length ? <div className="muted">Aguardando o worker desta empresa…</div> : null}
      </div>
    </section>
  );
}
