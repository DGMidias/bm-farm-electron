import { FIELD_LIMITS } from "@harness/ui-contract";
import type { AppConfig, ConnectionResult } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  live?: ConnectionResult;
  onChange: (config: AppConfig) => void;
}

export function OpenAiPage({ config, live, onChange }: Props) {
  const openai = config.openai;
  const connected = Boolean(live?.ok);

  return (
    <section className="page">
      <h1>OpenAI</h1>
      <p className="muted">
        A chave fica no userData local. O farm ainda não gasta token — esta tela só prova a conexão e mostra o que a API
        devolver. Crédito/uso exige chave de admin da organização.
      </p>
      <div className="form-panel">
        <div className={`live-badge ${connected ? "ok" : live ? "err" : ""}`}>
          {live ? live.mensagem : "Checando OpenAI…"}
        </div>
        <div className="form-grid flush">
          <Field
            id="openai-url"
            label="URL base da API"
            kind="url"
            maxLength={FIELD_LIMITS.url}
            wide
            value={openai.baseUrl}
            onChange={(baseUrl) => onChange({ ...config, openai: { ...openai, baseUrl } })}
          />
          <Field
            id="openai-key"
            label="API key"
            kind="secret"
            maxLength={FIELD_LIMITS.secret}
            type="password"
            wide
            value={openai.apiKey}
            onChange={(apiKey) => onChange({ ...config, openai: { ...openai, apiKey } })}
          />
        </div>
      </div>
      {connected ? (
        <div className="card">
          <strong>Agente</strong>
          <p className="muted">{live?.mensagem}</p>
        </div>
      ) : null}
    </section>
  );
}
