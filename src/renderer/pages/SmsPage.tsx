import { FIELD_LIMITS } from "@harness/ui-contract";
import { BR_DDDS, DEFAULT_DDD } from "@shared/ddd";
import type { AppConfig, ConnectionResult, SmsActivation, SmsService } from "@shared/types";
import { useEffect, useState } from "react";
import {
  activationOwnerLabel,
  activationStatusLabel,
  canCancelActivation,
  defaultSmsOption,
  formatActivationWhen,
  formatRestClock,
  formatSmsOptionLabel,
  latestSms,
  nationalPhone,
  resolveSmsSelection,
} from "@shared/sms-view";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onCreate: () => Promise<void>;
  onListNumbers: () => Promise<void>;
  onInbox: (activationId?: string) => Promise<void>;
  onCancel: (activationId: string) => Promise<void>;
  live?: ConnectionResult;
  action?: ConnectionResult;
  services: SmsService[];
  activation?: SmsActivation;
  busy?: boolean;
}

export function SmsPage({
  config,
  onChange,
  onCreate,
  onListNumbers,
  onInbox,
  onCancel,
  live,
  action,
  services,
  activation,
  busy,
}: Props) {
  const sms = config.sms;
  const [tab, setTab] = useState<"config" | "numbers">("config");
  const connected = Boolean(live?.ok);
  const serviceDisabled = !connected || services.length === 0;
  const currentDdd = sms.ddd === "" || BR_DDDS.some((item) => item.ddd === sms.ddd) ? sms.ddd : DEFAULT_DDD;
  const { group, option, allowsDdd } = resolveSmsSelection(services, sms);
  const options = group?.options ?? [];
  const last = latestSms(activation?.messages ?? []);
  const activations = sms.knownActivations ?? [];
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (tab !== "numbers") return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await onListNumbers();
      } finally {
        running = false;
      }
    };
    const poll = window.setInterval(() => {
      void tick();
    }, 8000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [tab, onListNumbers]);

  return (
    <section className="page">
      <h1>Provedor de SMS</h1>
      <p className="muted">
        Essas escolhas ficam salvas para o farm das BMs. Facebook é o grupo inicial. DDD 35 é o padrão, só entra se a opção aceitar, e é opcional com taxa de +30%.
      </p>
      <div className="form-panel">
        <div className={`live-badge ${connected ? "ok" : live ? "err" : ""}`}>
          {live ? live.mensagem : "Checando conexão…"}
        </div>
        <div className="form-grid flush">
          <Field
            id="sms-url"
            label="URL base da API"
            kind="url"
            maxLength={FIELD_LIMITS.url}
            wide
            value={sms.baseUrl}
            onChange={(baseUrl) => onChange({ ...config, sms: { ...sms, baseUrl } })}
          />
          <Field
            id="sms-key"
            label="API key"
            kind="secret"
            maxLength={FIELD_LIMITS.secret}
            type="password"
            wide
            value={sms.apiKey}
            onChange={(apiKey) => onChange({ ...config, sms: { ...sms, apiKey } })}
          />
        </div>
      </div>
      <div className="subnav" role="tablist">
        <button className={tab === "config" ? "active" : ""} type="button" onClick={() => setTab("config")}>
          Configuração
        </button>
        <button
          className={tab === "numbers" ? "active" : ""}
          type="button"
          onClick={() => {
            setTab("numbers");
            void onListNumbers();
          }}
        >
          Números
        </button>
      </div>
      {tab === "config" ? (
        <>
          <div className="form-grid">
            <label className="field" htmlFor="sms-group">
              <span>Grupo de serviço</span>
              <select
                id="sms-group"
                disabled={serviceDisabled}
                value={group?.id || sms.serviceId || "60033"}
                onChange={(event) => {
                  const next = services.find((item) => item.id === event.target.value);
                  const picked = defaultSmsOption(next?.options ?? []);
                  onChange({
                    ...config,
                    sms: {
                      ...sms,
                      serviceId: next?.id || event.target.value,
                      serviceCode: next?.code || sms.serviceCode,
                      apiId: picked?.apiId ?? "",
                    },
                  });
                }}
              >
                {services.length === 0 ? <option value={sms.serviceId || "60033"}>Facebook (aguardando conexão)</option> : null}
                {services.map((service) => (
                  <option key={service.id || service.code} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="sms-option">
              <span>
                Opção do serviço
                {allowsDdd ? (
                  <span className="ddd-pill" title="Esta opção aceita DDD">
                    ◎ DDD
                  </span>
                ) : null}
              </span>
              <select
                id="sms-option"
                disabled={serviceDisabled || options.length === 0}
                value={option?.apiId || sms.apiId || ""}
                onChange={(event) => onChange({ ...config, sms: { ...sms, apiId: event.target.value } })}
              >
                {options.length === 0 ? <option value={sms.apiId || ""}>Aguardando opções do grupo</option> : null}
                {options.map((item) => (
                  <option key={item.apiId} value={item.apiId}>
                    {formatSmsOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide" htmlFor="sms-ddd">
              <span>
                DDD
                {allowsDdd ? <small className="muted"> Opcional · taxa de +30%</small> : <small className="muted"> esta opção não aceita DDD</small>}
              </span>
              <select
                id="sms-ddd"
                disabled={!allowsDdd}
                value={currentDdd}
                onChange={(event) => onChange({ ...config, sms: { ...sms, ddd: event.target.value } })}
              >
                <option value="">Não usar · sem taxa extra</option>
                {BR_DDDS.map((item) => (
                  <option key={item.ddd} value={item.ddd}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button className="btn" type="button" disabled={busy || !connected} onClick={() => void onCreate()}>
              Gerar número
            </button>
          </div>
          {action ? <div className={action.ok ? "status ok" : "status err"}>{action.mensagem}</div> : null}
          {last ? (
            <div className="card">
              <strong>Último SMS do número atual</strong>
              <p>{last.text}</p>
              {last.code ? <p className="muted">Código: {last.code}</p> : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="card">
          {action ? <div className={action.ok ? "status ok" : "status err"}>{action.mensagem}</div> : null}
          <strong>Ativações em andamento</strong>
          <p className="muted">
            {activations.length
              ? `Mostrando ${activations.length} de ${activations.length} entradas · atualiza a cada 5s`
              : "O GET busca o que a plataforma está mostrando agora. Nada frio: só o que o app enxergar."}
          </p>
          {activations.length === 0 ? (
            <p className="muted">Nenhuma ativação visível. Gere um na configuração ou aguarde o próximo GET.</p>
          ) : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>Opção</th>
                    <th>Serviço</th>
                    <th>Empresa / perfil AdsPower</th>
                    <th>Número</th>
                    <th>Código SMS</th>
                    <th>Status</th>
                    <th>Rest</th>
                    <th>Ação</th>
                    <th>Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {activations.map((item, index) => {
                    const smsRow = latestSms(item.messages);
                    const smsText = smsRow?.code || smsRow?.text || "O código SMS chegará aqui.";
                    const cancelable = canCancelActivation(item, now);
                    const status = activationStatusLabel(item.status);
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="option-index">{item.optionLabel || String(index + 1)}</span>
                        </td>
                        <td>{item.serviceName || "—"}</td>
                        <td>{activationOwnerLabel(item)}</td>
                        <td>
                          <div className="phone-cell">
                            <CopyButton label="Copiar número completo" value={item.phone} />
                            <span className="shimmer">{item.phone || item.id}</span>
                            <CopyButton label="Copiar sem código do país" value={nationalPhone(item.phone)} />
                          </div>
                        </td>
                        <td>
                          <span className={smsRow ? "" : "shimmer muted"}>{smsText}</span>
                        </td>
                        <td>
                          <span className={`badge ${status === "ATIVO" ? "ok" : ""}`}>{status}</span>
                        </td>
                        <td>{formatRestClock(item.expiresAt, now)}</td>
                        <td>
                          <button className="btn ghost" type="button" disabled={busy || !cancelable} onClick={() => void onCancel(item.id)}>
                            Cancelar
                          </button>
                        </td>
                        <td>{formatActivationWhen(item.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
