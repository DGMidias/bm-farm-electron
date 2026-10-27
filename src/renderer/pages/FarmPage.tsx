import { FIELD_LIMITS } from "@harness/ui-contract";
import { adsProfileOption } from "@shared/cnpj-pdf";
import { emptyEmpresa, validateEmpresa, type EmpresaCard } from "@shared/empresa";
import { formatEmpresaFields } from "@shared/empresa-format";
import type { AdsPowerProfile, AppConfig, EngineStatus } from "@shared/types";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  engine: EngineStatus;
  profiles: AdsPowerProfile[];
  onChange: (config: AppConfig) => void;
  onStart: (id: string) => Promise<void>;
  onFill: (id: string, step: string) => Promise<void>;
  onDetect: () => Promise<void>;
  onStop: () => Promise<void>;
  onSaveSnapshot: (name: string) => Promise<void>;
  onPickDocument: (id: string) => Promise<void>;
  onRemove: (id: string) => void;
}

const STEPS = ["portfolio", "empresa", "whatsapp", "verificacao_dados", "verificacao_nome", "verificacao_endereco", "verificacao_contato"];

export function FarmPage({
  config,
  engine,
  profiles,
  onChange,
  onStart,
  onFill,
  onDetect,
  onStop,
  onSaveSnapshot,
  onPickDocument,
  onRemove,
}: Props) {
  const update = (id: string, patch: Partial<EmpresaCard>) => {
    onChange({
      ...config,
      empresas: config.empresas.map((item) => (item.id === id ? { ...item, ...formatEmpresaFields(patch) } : item)),
    });
  };

  return (
    <section className="page">
      <h1>Farm de BM</h1>
      <p className="muted">
        Rascunho desta aba some ao fechar o app. Só grava depois de iniciar o farm. O PDF é o comprovante CNPJ da Receita.
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
          const options = profiles.map(adsProfileOption);
          if (card.adspower_profile && !options.some((item) => item.value === card.adspower_profile)) {
            options.unshift({ value: card.adspower_profile, label: card.adspower_profile });
          }
          return (
            <article className="card" key={card.id}>
              <div className="card-head">
                <strong>Empresa {index + 1}</strong>
                <div className="row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={card.ler_pdf_automatico}
                      onChange={(event) => update(card.id, { ler_pdf_automatico: event.target.checked })}
                    />
                    Ler PDF
                  </label>
                  <button className="btn ghost" type="button" onClick={() => onRemove(card.id)}>
                    Excluir empresa
                  </button>
                </div>
              </div>
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
                <div className="field wide">
                  <span>Comprovante CNPJ</span>
                  <div className="row">
                    <button className="btn secondary" type="button" onClick={() => void onPickDocument(card.id)}>
                      Escolher PDF
                    </button>
                    <span className="muted">{card.documento_original || "Nenhum arquivo"}</span>
                  </div>
                </div>
                <label className="field" htmlFor={`${card.id}-ads`}>
                  <span>Perfil AdsPower</span>
                  <select
                    id={`${card.id}-ads`}
                    value={card.adspower_profile}
                    onChange={(event) => update(card.id, { adspower_profile: event.target.value })}
                  >
                    <option value="">{profiles.length ? "Selecione um perfil" : "Nenhum perfil visível ainda"}</option>
                    {options.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
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
