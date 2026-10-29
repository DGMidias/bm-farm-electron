import { FIELD_LIMITS } from "@harness/ui-contract";
import { inboxOwnerLabel, inboxStatusLabel, mailKindFromAddress, mailKindLabel } from "@shared/mail-view";
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
  onDelete: (address: string) => Promise<void>;
  onListInboxes: () => Promise<void>;
  onOpenInbox: (address: string) => Promise<void>;
}

export function EmailPage({
  config,
  live,
  action,
  busy,
  onChange,
  onCreate,
  onDelete,
  onListInboxes,
  onOpenInbox,
}: Props) {
  const email = config.email;
  const inboxes = email.knownInboxes ?? [];
  const [tab, setTab] = useState<"config" | "inboxes" | "messages">("config");
  const [selected, setSelected] = useState(email.lastAddress);
  const inbox = inboxes.find((item) => item.address === selected);
  const messages = inbox?.messages ?? [];
  const connected = Boolean(live?.ok);

  useEffect(() => {
    if (tab !== "inboxes") return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await onListInboxes();
      } finally {
        running = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 8000);
    return () => window.clearInterval(timer);
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
      <h1>Provedor de e-mail</h1>
      <p className="muted">
        A 22.do gera a caixa da etapa 1 em Gmail, Outlook ou Hotmail (sorteio) e entrega o link da Meta na etapa 3. Cole
        o token da dashboard em{" "}
        <a href="https://22.do/dash/" target="_blank" rel="noreferrer">
          22.do/dash
        </a>
        . Sem token o farm pausa. Sem estoque, o app compra 1 ID na 22.do.
      </p>
      <div className="form-panel">
        <div className={`live-badge ${connected ? "ok" : live ? "err" : ""}`}>
          {live ? live.mensagem : "Checando 22.do…"}
        </div>
        <div className="form-grid flush">
          <Field
            id="email-url"
            label="URL base da API"
            kind="url"
            maxLength={FIELD_LIMITS.url}
            wide
            value={email.baseUrl}
            onChange={(baseUrl) => onChange({ ...config, email: { ...email, baseUrl } })}
          />
          <Field
            id="email-token"
            label="Token"
            kind="secret"
            maxLength={FIELD_LIMITS.secret}
            type="password"
            wide
            value={email.token}
            onChange={(token) => onChange({ ...config, email: { ...email, token } })}
          />
        </div>
      </div>
      <div className="subnav" role="tablist">
        <button className={tab === "config" ? "active" : ""} type="button" onClick={() => setTab("config")}>
          Configuração
        </button>
        <button
          className={tab === "inboxes" || tab === "messages" ? "active" : ""}
          type="button"
          onClick={() => setTab("inboxes")}
        >
          Caixas
        </button>
      </div>
      {tab === "config" ? (
        <div className="card">
          {action ? <div className={action.ok ? "status ok" : "status err"}>{action.mensagem}</div> : null}
          <strong>Status da 22.do</strong>
          <p className="muted">
            URL padrão <code>https://22.do/api/v2</code>. Toda caixa nova é Gmail, Outlook ou Hotmail — um dos três, à
            sorte. Sem estoque, compra 1 ID (desconta o saldo). A listagem fica em Caixas.
          </p>
          <div className="row">
            <button className="btn" type="button" disabled={busy || !connected} onClick={() => void onCreate()}>
              Gerar caixa nova
            </button>
          </div>
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
          <p className="muted">
            Cada linha liga empresa e perfil AdsPower. Novas caixas são Gmail, Outlook ou Hotmail. Caixas mail.tm ou
            twbeta antigas ficam no histórico — gere uma nova.
          </p>
          {inboxes.length === 0 ? (
            <p className="muted">Nenhuma caixa ainda. Gere uma para receber confirmação.</p>
          ) : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>Endereço</th>
                    <th>Tipo</th>
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
                      <td>{mailKindLabel(item.kind ?? mailKindFromAddress(item.address))}</td>
                      <td>{inboxOwnerLabel(item)}</td>
                      <td>
                        <span className={`badge ${item.active ? "ok" : ""}`}>{inboxStatusLabel(item.active)}</span>
                      </td>
                      <td>{item.messages.length}</td>
                      <td>{formatActivationWhen(item.createdAt)}</td>
                      <td>
                        <div className="row">
                          <button
                            className="btn secondary"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setSelected(item.address);
                              setTab("messages");
                              void onOpenInbox(item.address);
                            }}
                          >
                            Mensagens
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (selected === item.address) {
                                setSelected("");
                                setTab("inboxes");
                              }
                              void onDelete(item.address);
                            }}
                          >
                            Excluir
                          </button>
                        </div>
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
          <p className="muted">Atualiza a cada 8s. O que chegar fica no histórico local, mesmo se a API esquecer depois.</p>
          {messages.length === 0 ? (
            <p className="muted">Nenhuma mensagem ainda. Peça o e-mail na Meta e aguarde.</p>
          ) : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>De</th>
                    <th>Assunto</th>
                    <th>Prévia</th>
                    <th>Link</th>
                    <th>Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((message) => (
                    <tr key={message.id}>
                      <td>{message.from || "—"}</td>
                      <td>{message.subject || "(sem assunto)"}</td>
                      <td>{message.intro || "—"}</td>
                      <td>{message.link ? "confirmação" : "—"}</td>
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
