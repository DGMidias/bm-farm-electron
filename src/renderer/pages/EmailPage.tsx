import { FIELD_LIMITS } from "@harness/ui-contract";
import type { AppConfig, MailMessage } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  messages: MailMessage[];
  onChange: (config: AppConfig) => void;
  onCreate: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function EmailPage({ config, messages, onChange, onCreate, onRefresh }: Props) {
  return (
    <section className="page">
      <h1>E-mail temporário</h1>
      <p className="muted">
        Adapter mail.tm, usado só na etapa de validação da BM. A caixa não deve ser reutilizada como identidade da conta.
      </p>
      <div className="form-grid">
        <Field
          id="mail-pass"
          label="Senha da caixa (gerada se vazia)"
          kind="secret"
          maxLength={FIELD_LIMITS.secret}
          type="password"
          value={config.email.password}
          onChange={(password) => onChange({ ...config, email: { ...config.email, password } })}
        />
        <Field
          id="mail-addr"
          label="Último endereço"
          kind="medium"
          maxLength={FIELD_LIMITS.medium}
          value={config.email.lastAddress}
          onChange={(lastAddress) => onChange({ ...config, email: { ...config.email, lastAddress } })}
        />
      </div>
      <div className="row">
        <button className="btn" type="button" onClick={() => void onCreate()}>
          Gerar caixa
        </button>
        <button className="btn secondary" type="button" onClick={() => void onRefresh()}>
          Ler mensagens
        </button>
      </div>
      <div className="card">
        <strong>Mensagens</strong>
        {messages.length === 0 ? <p className="muted">Nenhuma mensagem ainda.</p> : null}
        {messages.map((message) => (
          <div key={message.id}>
            <div>{message.subject || "(sem assunto)"}</div>
            <div className="muted">
              {message.from} — {message.intro}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
