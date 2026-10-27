import { FIELD_LIMITS } from "@harness/ui-contract";
import type { AppLog, HistoryEvent, HistoryStatus } from "@shared/types";
import { useMemo, useState } from "react";
import { Field } from "../components/Field";

interface Props {
  events: HistoryEvent[];
  logs: AppLog[];
}

export function HistoryPage({ events, logs }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<HistoryStatus | "">("");
  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const blob = `${event.razaoSocial} ${event.cnpj} ${event.adspowerProfile} ${event.mensagem}`.toLowerCase();
        const okQuery = !query || blob.includes(query.toLowerCase());
        const okStatus = !status || event.status === status;
        return okQuery && okStatus;
      }),
    [events, query, status],
  );

  return (
    <section className="page">
      <h1>Histórico de BMs</h1>
      <p className="muted">Consulta local. Senha, OTP e cookie nunca entram neste log.</p>
      <div className="form-grid">
        <Field id="hist-q" label="Busca" maxLength={FIELD_LIMITS.medium} value={query} onChange={setQuery} />
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as HistoryStatus | "")}>
            <option value="">Todos</option>
            <option value="rascunho">rascunho</option>
            <option value="em_andamento">em_andamento</option>
            <option value="pausado_humano">pausado_humano</option>
            <option value="ok">ok</option>
            <option value="erro">erro</option>
          </select>
        </label>
      </div>
      <div className="card">
        <table className="history-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Empresa</th>
              <th>Perfil</th>
              <th>Etapa</th>
              <th>Status</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr key={event.id}>
                <td>{event.timestamp}</td>
                <td>
                  {event.razaoSocial} · {event.cnpj}
                </td>
                <td>{event.adspowerProfile}</td>
                <td>{event.etapa}</td>
                <td>
                  <span className="badge">{event.status}</span>
                </td>
                <td>{event.mensagem}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="muted">Nenhum evento.</p> : null}
      </div>
      <div className="card">
        <strong>Logs do app</strong>
        <p className="muted">error e warning também saem no terminal do `npm run dev` e em userData/logs/app.log. Chaves não entram no texto.</p>
        {logs.length === 0 ? <p className="muted">Nenhum log ainda.</p> : null}
        <div className="log-list">
          {logs.map((entry) => (
            <div key={entry.id} className={`log-line ${entry.level}`}>
              <span>{entry.timestamp}</span> [{entry.level}] [{entry.scope}] {entry.message}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
