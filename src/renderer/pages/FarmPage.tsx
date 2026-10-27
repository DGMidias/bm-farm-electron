import { FIELD_LIMITS } from "@harness/ui-contract";
import { adsProfileOption } from "@shared/cnpj-pdf";
import { emptyEmpresa, farmFieldErrors, validateFarmStart, type EmpresaCard } from "@shared/empresa";
import { clampBatchSize } from "@shared/farm-etapas";
import type { AdsPowerProfile, AppConfig } from "@shared/types";
import { useState } from "react";
import { Field } from "../components/Field";

interface Props {
  config: AppConfig;
  profiles: AdsPowerProfile[];
  onChange: (config: AppConfig) => void;
  onStartFarm: () => Promise<void>;
  onPickDocument: (id: string) => Promise<void>;
  onRemove: (id: string) => void;
}

export function FarmPage({ config, profiles, onChange, onStartFarm, onPickDocument, onRemove }: Props) {
  const [attempted, setAttempted] = useState(false);
  const known = profiles.flatMap((item) => [item.userId, item.serial].filter((value): value is string => Boolean(value)));
  const startErrors = validateFarmStart(config.empresas, known);
  const fieldErrors = attempted ? farmFieldErrors(config.empresas, known) : {};
  const maxBatch = Math.max(1, config.empresas.length);

  const update = (id: string, patch: Partial<EmpresaCard>) => {
    onChange({
      ...config,
      empresas: config.empresas.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const tryStart = () => {
    setAttempted(true);
    if (validateFarmStart(config.empresas, known).length) return;
    void onStartFarm();
  };

  return (
    <section className="page">
      <h1>Farm de BM</h1>
      <p className="muted">
        Um botão inicia o lote. Esta fase cria só o portfólio empresarial no Chromium do AdsPower. O rascunho grava ao
        clicar em Iniciar farm.
      </p>
      <div className="farm-toolbar">
        <button className="btn" type="button" onClick={() => onChange({ ...config, empresas: [...config.empresas, emptyEmpresa()] })}>
          Adicionar empresa
        </button>
        <label className="lote-field" htmlFor="farm-batch">
          <span>Tamanho do lote</span>
          <input
            id="farm-batch"
            type="number"
            min={1}
            max={maxBatch}
            value={clampBatchSize(config.farm.batchSize, maxBatch)}
            onChange={(event) =>
              onChange({
                ...config,
                farm: { ...config.farm, batchSize: clampBatchSize(Number(event.target.value), maxBatch) },
              })
            }
          />
        </label>
        <button className="btn farm-start" type="button" onClick={tryStart}>
          Iniciar farm
        </button>
      </div>
      {attempted && startErrors.length ? <div className="status err">{startErrors[0]}</div> : null}
      <div className="list empresa-list">
        {config.empresas.map((card, index) => {
          const errors = fieldErrors[card.id] ?? {};
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
                <Field id={`${card.id}-razao`} label="Razão social" maxLength={FIELD_LIMITS.medium} value={card.razao_social} invalid={Boolean(errors.razao_social)} error={errors.razao_social} onChange={(razao_social) => update(card.id, { razao_social })} />
                <Field id={`${card.id}-cnpj`} label="CNPJ" maxLength={FIELD_LIMITS.cnpj} value={card.cnpj} invalid={Boolean(errors.cnpj)} error={errors.cnpj} onChange={(cnpj) => update(card.id, { cnpj })} />
                <Field id={`${card.id}-resp`} label="Responsável" maxLength={FIELD_LIMITS.medium} value={card.responsavel} invalid={Boolean(errors.responsavel)} error={errors.responsavel} onChange={(responsavel) => update(card.id, { responsavel })} />
                <Field id={`${card.id}-email`} label="E-mail comercial" maxLength={FIELD_LIMITS.medium} value={card.email_comercial} invalid={Boolean(errors.email_comercial)} error={errors.email_comercial} onChange={(email_comercial) => update(card.id, { email_comercial })} />
                <Field id={`${card.id}-end`} label="Endereço" maxLength={FIELD_LIMITS.long} wide value={card.endereco} invalid={Boolean(errors.endereco)} error={errors.endereco} onChange={(endereco) => update(card.id, { endereco })} />
                <Field id={`${card.id}-comp`} label="Complemento" maxLength={FIELD_LIMITS.medium} value={card.complemento} onChange={(complemento) => update(card.id, { complemento })} />
                <Field id={`${card.id}-cid`} label="Cidade" maxLength={FIELD_LIMITS.medium} value={card.cidade} invalid={Boolean(errors.cidade)} error={errors.cidade} onChange={(cidade) => update(card.id, { cidade })} />
                <Field id={`${card.id}-uf`} label="UF" maxLength={FIELD_LIMITS.uf} value={card.estado} invalid={Boolean(errors.estado)} error={errors.estado} onChange={(estado) => update(card.id, { estado })} />
                <Field id={`${card.id}-cep`} label="CEP" maxLength={FIELD_LIMITS.cep} value={card.cep} invalid={Boolean(errors.cep)} error={errors.cep} onChange={(cep) => update(card.id, { cep })} />
                <Field id={`${card.id}-tel`} label="Telefone" maxLength={FIELD_LIMITS.phone} value={card.telefone} invalid={Boolean(errors.telefone)} error={errors.telefone} onChange={(telefone) => update(card.id, { telefone })} />
                <Field id={`${card.id}-site`} label="Site HTTPS" maxLength={FIELD_LIMITS.url} value={card.site} invalid={Boolean(errors.site)} error={errors.site} onChange={(site) => update(card.id, { site })} />
                <div className={`field wide${errors.documento_original ? " invalid" : ""}`}>
                  <span>Comprovante CNPJ</span>
                  <div className="row">
                    <button className="btn secondary" type="button" onClick={() => void onPickDocument(card.id)}>
                      Escolher PDF
                    </button>
                    <span className="muted">{card.documento_original || "Nenhum arquivo"}</span>
                  </div>
                  {errors.documento_original ? <small className="field-error">{errors.documento_original}</small> : null}
                </div>
                <label className={`field${errors.adspower_profile ? " invalid" : ""}`} htmlFor={`${card.id}-ads`}>
                  <span>Perfil AdsPower</span>
                  <select
                    id={`${card.id}-ads`}
                    value={card.adspower_profile}
                    aria-invalid={errors.adspower_profile ? true : undefined}
                    onChange={(event) => update(card.id, { adspower_profile: event.target.value })}
                  >
                    <option value="">{profiles.length ? "Selecione um perfil" : "Nenhum perfil visível ainda"}</option>
                    {options.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {errors.adspower_profile ? <small className="field-error">{errors.adspower_profile}</small> : null}
                </label>
              </div>
              <label className={`check${errors.autorizado_pela_empresa ? " invalid" : ""}`}>
                <input type="checkbox" checked={card.autorizado_pela_empresa} onChange={(event) => update(card.id, { autorizado_pela_empresa: event.target.checked })} />
                Autorizado pela empresa
              </label>
              {errors.autorizado_pela_empresa ? <small className="field-error">{errors.autorizado_pela_empresa}</small> : null}
              <label className={`check${errors.documento_sem_alteracao_de_conteudo ? " invalid" : ""}`}>
                <input type="checkbox" checked={card.documento_sem_alteracao_de_conteudo} onChange={(event) => update(card.id, { documento_sem_alteracao_de_conteudo: event.target.checked })} />
                Documento original sem alteração
              </label>
              {errors.documento_sem_alteracao_de_conteudo ? <small className="field-error">{errors.documento_sem_alteracao_de_conteudo}</small> : null}
              <p className="muted">Etapa 1 sempre gera uma caixa mail.tm nova (é nela que chega a verificação da Meta). O e-mail do PDF não entra no formulário.</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
