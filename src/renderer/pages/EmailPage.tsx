import { FIELD_LIMITS } from "@harness/ui-contract";
import { inboxStatusLabel } from "@shared/mail-view";
import { formatActivationWhen } from "@shared/sms-view";
import type { AppConfig, ConnectionResult } from "@shared/types";
import { useEffect, useState } from "react";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  live?: ConnectionResult;
  action?: ConnectionResult;
  busy?: boolean;
  onChange: (config: AppConfig) => void;
  onCreate: () => Promise<void>;
  onListInboxes: () => Promise<void>;
  onOpenInbox: (address: string) => Promise<void>;
}

export function EmailPage({ config, live, action, busy, onChange, onCreate, onListInboxes, onOpenInbox }: Props) {
  const inboxes = config.email.knownInboxes ?? [];
  const [tab, setTab] = useState<"service" | "inboxes" | "messages">("service");
  const [selected, setSelected] = useState(config.email.lastAddress);
  const inbox = inboxes.find((item) => item.address === selected);
  const messages = inbox?.messages ?? [];
  const connected = Boolean(live?.ok);

  useEffect(() => {
    if (tab !== "inboxes") return;
    void onListInboxes();
  }, [tab, onListInboxes]);

  useEffect(() => {
    if (tab !== "messages" || !selected) return;
    void onOpenInbox(selected);
    const timer = window.setInterval(() => {
      void onOpenInbox(selected);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [tab, selected, onOpenInbox]);

  return (
    <section className="page">
      <h1>E-mail temporário</h1>
      <p className="muted">
        22.do só entra na validação da BM. Cole o token da conta em{" "}
        <a href="https://22.do/document" target="_blank" rel="noreferrer">
          22.do/document
        </a>
        . Gerar e ler fica nas subabas.
      </p>
      <div className="form-panel">
        <div className={`live-badge ${connected ? "ok" : live ? "err" : ""}`}>{live ? live.mensagem : "Checando 22.do…"}</div>
        <div className="form-grid flush">
          <Field
            id="mail-url"
            label="URL base da API"
            kind="url"
            maxLength={FIELD_LIMITS.url}
            wide
            value={config.email.baseUrl}
            onChange={(baseUrl) => onChange({ ...config, email: { ...config.email, baseUrl } })}
          />
          <Field
            id="mail-key"
            label="Token da 22.do"
            kind="secret"
            maxLength={FIELD_LIMITS.secret}
            type="password"
            wide
            value={config.email.apiKey}
            onChange={(apiKey) => onChange({ ...config, email: { ...config.email, apiKey, bearer: "", bearerExpires: 0 } })}
          />
        </div>
      </div>
      <div className="subnav" role="tablist">
        <button className={tab === "service" ? "active" : ""} type="button" onClick={() => setTab("service")}>
          Serviço
        </button>
        <button
          className={tab === "inboxes" ? "active" : ""}
          type="button"
          onClick={() => setTab("inboxes")}
        >
          Caixas
        </button>
        <button
          className={tab === "messages" ? "active" : ""}
          type="button"
          disabled={!selected}
          onClick={() => setTab("messages")}
        >
          Mensagens
        </button>
      </div>
      {tab === "service" ? (
        <div className="card">
          <strong>Status da 22.do</strong>
          <p className="muted">Sem gerar caixa aqui. Se o badge estiver ok, abra Caixas para criar um endereço e receber e-mail.</p>
        </div>
      ) : null}
      {tab === "inboxes" ? (
        <div className="card">
          {action ? <div className={action.ok ? "status ok" : "status err"}>{action.mensagem}</div> : null}
          <div className="row">
            <button className="btn" type="button" disabled={busy || !connected} onClick={() => void onCreate()}>
              Gerar caixa nova
            </button>
          </div>
          <strong>Caixas geradas neste app</strong>
          <p className="muted">A 22.do cria a caixa no POST /account. Guardamos o que o app criar e o que o POST /inbox enxergar.</p>
          {inboxes.length === 0 ? (
            <p className="muted">Nenhuma caixa ainda. Gere uma para receber confirmação.</p>
          ) : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>Endereço</th>
                    <th>Status</th>
                    <th>Msgs</th>
                    <th>Criada</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxes.map((item) => (
                    <tr key={item.id || item.address}>
                      <td>{item.address}</td>
                      <td>
                        <span className={`badge ${item.active ? "ok" : ""}`}>{inboxStatusLabel(item.active)}</span>
                      </td>
                      <td>{item.messages.length}</td>
                      <td>{formatActivationWhen(item.createdAt)}</td>
                      <td>
                        <button
                          className="btn secondary"
                          type="button"
                          disabled={busy || !item.active}
                          onClick={() => {
                            setSelected(item.address);
                            setTab("messages");
                            void onOpenInbox(item.address);
                          }}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
      {tab === "messages" ? (
        <div className="card">
          {action ? <div className={action.ok ? "status ok" : "status err"}>{action.mensagem}</div> : null}
          <strong>{selected || "Mensagens"}</strong>
          <p className="muted">Atualiza a cada 5s. O que chegar fica no histórico local, mesmo se a API esquecer depois.</p>
          {messages.length === 0 ? (
            <p className="muted">Nenhuma mensagem ainda. Peça o e-mail na Meta e aguarde o GET.</p>
          ) : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>De</th>
                    <th>Assunto</th>
                    <th>Prévia</th>
                    <th>Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((message) => (
                    <tr key={message.id}>
                      <td>{message.from || "—"}</td>
                      <td>{message.subject || "(sem assunto)"}</td>
                      <td>{message.intro || "—"}</td>
                      <td>{formatActivationWhen(message.receivedAt || message.seenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
