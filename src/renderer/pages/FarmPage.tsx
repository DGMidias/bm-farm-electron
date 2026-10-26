import { FIELD_LIMITS } from "@harness/ui-contract";
import { emptyEmpresa, validateEmpresa, type EmpresaCard } from "@shared/empresa";
import type { AppConfig, EngineStatus } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  engine: EngineStatus;
  onChange: (config: AppConfig) => void;
  onStart: (id: string) => Promise<void>;
  onFill: (id: string, step: string) => Promise<void>;
  onDetect: () => Promise<void>;
  onStop: () => Promise<void>;
  onSaveSnapshot: (name: string) => Promise<void>;
}

const STEPS = ["portfolio", "empresa", "whatsapp", "verificacao_dados", "verificacao_nome", "verificacao_endereco", "verificacao_contato"];

export function FarmPage({ config, engine, onChange, onStart, onFill, onDetect, onStop, onSaveSnapshot }: Props) {
  const update = (id: string, patch: Partial<EmpresaCard>) => {
    onChange({
      ...config,
      empresas: config.empresas.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  return (
    <section className="page">
      <h1>Farm de BM</h1>
      <p className="muted">
        Cada card é uma empresa e um perfil AdsPower. A sessão supervisionada preenche no navegador do AdsPower.
      </p>
      <div className="row">
        <button className="btn" type="button" onClick={() => onChange({ ...config, empresas: [...config.empresas, emptyEmpresa()] })}>
          Adicionar empresa
        </button>
        <button className="btn secondary" type="button" onClick={() => void onDetect()}>
          Detectar tela
        </button>
        <button className="btn ghost" type="button" onClick={() => void onSaveSnapshot("manual")}>
          Gravar snapshot
        </button>
        <button className="btn ghost" type="button" onClick={() => void onStop()}>
          Encerrar sessão
        </button>
      </div>
      <div className="status">{engine.mensagem}{engine.screen ? ` · tela ${engine.screen}` : ""}</div>
      <div className="list empresa-list">
        {config.empresas.map((card, index) => {
          const errors = validateEmpresa(card);
          return (
            <article className="card" key={card.id}>
              <strong>Empresa {index + 1}</strong>
              <div className="form-grid">
                <Field id={`${card.id}-razao`} label="Razão social" maxLength={FIELD_LIMITS.medium} value={card.razao_social} onChange={(razao_social) => update(card.id, { razao_social })} />
                <Field id={`${card.id}-cnpj`} label="CNPJ" maxLength={FIELD_LIMITS.cnpj} value={card.cnpj} onChange={(cnpj) => update(card.id, { cnpj })} />
                <Field id={`${card.id}-resp`} label="Responsável" maxLength={FIELD_LIMITS.medium} value={card.responsavel} onChange={(responsavel) => update(card.id, { responsavel })} />
                <Field id={`${card.id}-email`} label="E-mail comercial" maxLength={FIELD_LIMITS.medium} value={card.email_comercial} onChange={(email_comercial) => update(card.id, { email_comercial })} />
                <Field id={`${card.id}-end`} label="Endereço" maxLength={FIELD_LIMITS.long} wide value={card.endereco} onChange={(endereco) => update(card.id, { endereco })} />
                <Field id={`${card.id}-comp`} label="Complemento" maxLength={FIELD_LIMITS.medium} value={card.complemento} onChange={(complemento) => update(card.id, { complemento })} />
                <Field id={`${card.id}-cid`} label="Cidade" maxLength={FIELD_LIMITS.medium} value={card.cidade} onChange={(cidade) => update(card.id, { cidade })} />
                <Field id={`${card.id}-uf`} label="UF" maxLength={FIELD_LIMITS.uf} value={card.estado} onChange={(estado) => update(card.id, { estado })} />
                <Field id={`${card.id}-cep`} label="CEP" maxLength={FIELD_LIMITS.cep} value={card.cep} onChange={(cep) => update(card.id, { cep })} />
                <Field id={`${card.id}-tel`} label="Telefone" maxLength={FIELD_LIMITS.phone} value={card.telefone} onChange={(telefone) => update(card.id, { telefone })} />
                <Field id={`${card.id}-site`} label="Site HTTPS" maxLength={FIELD_LIMITS.url} value={card.site} onChange={(site) => update(card.id, { site })} />
                <Field id={`${card.id}-doc`} label="Documento original" maxLength={FIELD_LIMITS.long} value={card.documento_original} onChange={(documento_original) => update(card.id, { documento_original })} />
                <Field id={`${card.id}-ads`} label="Perfil AdsPower (user_id ou serial)" maxLength={FIELD_LIMITS.medium} value={card.adspower_profile} onChange={(adspower_profile) => update(card.id, { adspower_profile })} />
              </div>
              <label className="check">
                <input type="checkbox" checked={card.usar_email_temporario} onChange={(event) => update(card.id, { usar_email_temporario: event.target.checked })} />
                Usar e-mail temporário só na validação
              </label>
              <label className="check">
                <input type="checkbox" checked={card.autorizado_pela_empresa} onChange={(event) => update(card.id, { autorizado_pela_empresa: event.target.checked })} />
                Autorizado pela empresa
              </label>
              <label className="check">
                <input type="checkbox" checked={card.documento_sem_alteracao_de_conteudo} onChange={(event) => update(card.id, { documento_sem_alteracao_de_conteudo: event.target.checked })} />
                Documento original sem alteração
              </label>
              {errors.length ? <div className="status err">{errors[0]}</div> : <div className="status ok">Card válido para sessão supervisionada.</div>}
              <div className="row">
                <button className="btn" type="button" onClick={() => void onStart(card.id)}>
                  Iniciar sessão
                </button>
                {STEPS.map((step) => (
                  <button key={step} className="btn ghost" type="button" onClick={() => void onFill(card.id, step)}>
                    Preencher {step}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
