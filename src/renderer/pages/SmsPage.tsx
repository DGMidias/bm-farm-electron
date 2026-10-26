import { FIELD_LIMITS } from "@harness/ui-contract";
import type { AppConfig, ConnectionResult } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onTest: () => Promise<void>;
  result?: ConnectionResult;
}

export function SmsPage({ config, onChange, onTest, result }: Props) {
  const sms = config.sms;
  return (
    <section className="page">
      <h1>Provedor de SMS</h1>
      <p className="muted">
        Credenciais de <a href="https://app.numero-virtual.com.br/developers">app.numero-virtual.com.br/developers</a>.
        Só testamos conexão nesta tela; comprar número entra depois, se a chave estiver salva.
      </p>
      <div className="form-grid">
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
      <div className="row">
        <button className="btn" type="button" onClick={() => void onTest()}>
          Testar conexão
        </button>
      </div>
      {result ? <div className={result.ok ? "status ok" : "status err"}>{result.mensagem}</div> : null}
    </section>
  );
}
