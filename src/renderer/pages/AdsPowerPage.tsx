import { FIELD_LIMITS } from "@harness/ui-contract";
import type { AppConfig, ConnectionResult, EngineStatus } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onTest: () => Promise<void>;
  onProbe: () => Promise<void>;
  onStop: () => Promise<void>;
  result?: ConnectionResult;
  engine: EngineStatus;
  busy?: boolean;
}

export function AdsPowerPage({ config, onChange, onTest, onProbe, onStop, result, engine, busy }: Props) {
  return (
    <section className="page">
      <h1>AdsPower</h1>
      <p className="muted">
        Conexão local. O teste de controle abre o perfil no Chromium do AdsPower via CDP. O Facebook nunca carrega nesta janela.
      </p>
      <div className="form-grid">
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
        <Field
          id="ads-profile"
          label="Perfil de teste (user_id ou serial, ex.: 2)"
          maxLength={FIELD_LIMITS.medium}
          wide
          value={config.adspower.testProfile}
          onChange={(testProfile) => onChange({ ...config, adspower: { ...config.adspower, testProfile } })}
        />
      </div>
      <div className="row">
        <button className="btn" type="button" disabled={busy} onClick={() => void onTest()}>
          Testar API local
        </button>
        <button className="btn" type="button" disabled={busy} onClick={() => void onProbe()}>
          Abrir e controlar navegador
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={() => void onStop()}>
          Fechar navegador
        </button>
      </div>
      {result ? <div className={result.ok ? "status ok" : "status err"}>{result.mensagem}</div> : null}
      <div className={engine.running ? "status ok" : "status"}>{engine.mensagem}</div>
    </section>
  );
}
