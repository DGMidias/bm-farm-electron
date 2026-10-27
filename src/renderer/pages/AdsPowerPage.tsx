import { FIELD_LIMITS } from "@harness/ui-contract";
import { formatAdsPowerCell, formatAdsPowerOpen, formatAdsPowerProxy, formatAdsPowerStatus } from "@shared/adspower-view";
import type { AdsPowerProfile, AppConfig, ConnectionResult } from "@shared/types";
import { useEffect } from "react";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  live?: ConnectionResult;
  profiles: AdsPowerProfile[];
  listError?: string;
  onListProfiles: () => Promise<void>;
}

export function AdsPowerPage({ config, onChange, live, profiles, listError, onListProfiles }: Props) {
  const connected = Boolean(live?.ok);

  useEffect(() => {
    if (!connected) return;
    void onListProfiles();
    const timer = window.setInterval(() => {
      void onListProfiles();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [connected, onListProfiles]);

  return (
    <section className="page">
      <h1>AdsPower</h1>
      <p className="muted">
        A badge testa a API local a cada 5s. Com a conexão ok, a tabela lista os perfis do AdsPower. O Facebook nunca carrega nesta janela.
      </p>
      <div className="form-panel">
        <div className={`live-badge ${connected ? "ok" : live ? "err" : ""}`}>{live ? live.mensagem : "Checando AdsPower…"}</div>
        <div className="form-grid flush">
          <Field
            id="ads-url"
            label="URL da API"
            kind="url"
            maxLength={FIELD_LIMITS.url}
            value={config.adspower.baseUrl}
            onChange={(baseUrl) => onChange({ ...config, adspower: { ...config.adspower, baseUrl } })}
          />
          <Field
            id="ads-key"
            label="API key"
            kind="secret"
            maxLength={FIELD_LIMITS.secret}
            type="password"
            value={config.adspower.apiKey}
            onChange={(apiKey) => onChange({ ...config, adspower: { ...config.adspower, apiKey } })}
          />
        </div>
      </div>
      {connected ? (
        <div className="card">
          <strong>Perfis no AdsPower</strong>
          <p className="muted">
            {profiles.length
              ? `${profiles.length} perfil${profiles.length === 1 ? "" : "is"} · atualiza a cada 5s`
              : listError || "A API local está ok. Nenhum perfil visível neste GET."}
          </p>
          {profiles.length === 0 && !listError ? (
            <p className="muted">Crie um perfil no AdsPower ou aguarde o próximo GET.</p>
          ) : profiles.length === 0 ? null : (
            <div className="activations-wrap">
              <table className="history-table activations-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Nome</th>
                    <th>ID</th>
                    <th>Grupo</th>
                    <th>Conta</th>
                    <th>Plataforma</th>
                    <th>Proxy</th>
                    <th>Observação</th>
                    <th>Status</th>
                    <th>Última abertura</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((item) => (
                    <tr key={item.userId}>
                      <td>
                        <span className="option-index">{formatAdsPowerCell(item.serial)}</span>
                      </td>
                      <td>{formatAdsPowerCell(item.name)}</td>
                      <td>{item.userId}</td>
                      <td>{formatAdsPowerCell(item.groupName)}</td>
                      <td>{formatAdsPowerCell(item.username)}</td>
                      <td>{formatAdsPowerCell(item.domain)}</td>
                      <td>{formatAdsPowerProxy(item.ip, item.ipCountry)}</td>
                      <td>{formatAdsPowerCell(item.remark)}</td>
                      <td>
                        <span className={`badge ${item.status === "aberto" ? "ok" : ""}`}>{formatAdsPowerStatus(item.status)}</span>
                      </td>
                      <td>{formatAdsPowerOpen(item.lastOpenAt)}</td>
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
