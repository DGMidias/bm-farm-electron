import { inboxOwnerLabel, inboxStatusLabel } from "@shared/mail-view";
import { formatActivationWhen } from "@shared/sms-view";
import type { AppConfig, ConnectionResult } from "@shared/types";
import { useEffect, useState } from "react";

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

export function EmailPage({ config, live, action, busy, onCreate, onListInboxes, onOpenInbox }: Props) {
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
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await onOpenInbox(selected);
      } finally {
        running = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 8000);
    return () => window.clearInterval(timer);
  }, [tab, selected, onOpenInbox]);

  return (
    <section className="page">
      <h1>E-mail temporário</h1>
      <p className="muted">mail.tm entra na criação do portfólio. A aba principal só confere se o serviço está no ar; gerar e ler fica nas subabas.</p>
      <div className="form-panel">
        <div className={`live-badge ${connected ? "ok" : live ? "err" : ""}`}>{live ? live.mensagem : "Checando mail.tm…"}</div>
      </div>
      <div className="subnav" role="tablist">
        <button className={tab === "service" ? "active" : ""} type="button" onClick={() => setTab("service")}>
          Serviço
        </button>
        <button className={tab === "inboxes" || tab === "messages" ? "active" : ""} type="button" onClick={() => setTab("inboxes")}>
          Caixas
        </button>
      </div>
      {tab === "service" ? (
        <div className="card">
          <strong>Status do mail.tm</strong>
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
          <p className="muted">O mail.tm não lista histórico da conta. Guardamos o que o app criar e o GET confirmar.</p>
          {inboxes.length === 0 ? (
            <p className="muted">Nenhuma caixa ainda. Gere uma para receber confirmação.</p>
          ) : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>Endereço</th>
                    <th>Empresa / perfil AdsPower</th>
                    <th>Status</th>
                    <th>Msgs</th>
                    <th>Criada</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxes.map((item) => (
                    <tr key={item.id || item.address}>
                      <td>
                        <div className="phone-cell">
                          <span>{item.address}</span>
                          <CopyButton label="Copiar e-mail" value={item.address} />
                        </div>
                      </td>
                      <td>{inboxOwnerLabel(item)}</td>
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
                          Mensagens
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

function CopyButton({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <button
      className="copy-btn"
      type="button"
      title={label}
      aria-label={label}
      onClick={() => void navigator.clipboard?.writeText(value)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect width="14" height="14" x="8" y="8" rx="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
    </button>
  );
}
