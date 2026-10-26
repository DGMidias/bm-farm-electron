import { FIELD_LIMITS } from "@harness/ui-contract";
import type { AppConfig, ConnectionResult } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onTest: () => Promise<void>;
  result?: ConnectionResult;
}

export function AdsPowerPage({ config, onChange, onTest, result }: Props) {
  return (
    <section className="page">
      <h1>AdsPower</h1>
      <p className="muted">API local. O Facebook abre no Chromium do perfil, nunca nesta janela.</p>
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
      </div>
      <div className="row">
        <button className="btn" type="button" onClick={() => void onTest()}>
          Testar /status
        </button>
      </div>
      {result ? <div className={result.ok ? "status ok" : "status err"}>{result.mensagem}</div> : null}
    </section>
  );
}
