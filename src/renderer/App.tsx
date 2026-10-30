import type { DesktopApi } from "../preload";
import { settingsToSave } from "@shared/farm-draft";
import { farmNeedsReview } from "@shared/farm-run";
import { navShowsIntegrationAlert } from "@shared/integration-status";
import { DEFAULT_CONFIG, type AdsPowerProfile, type AppConfig, type AppLog, type ConnectionResult, type EngineStatus, type FarmRunState, type HistoryEvent, type HumanPause, type MenuId, type SmsActivation, type SmsService, type UpdateCheckResult } from "@shared/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdsPowerPage } from "./pages/AdsPowerPage";
import { EmailPage } from "./pages/EmailPage";
import { FarmPage } from "./pages/FarmPage";
import { FarmRunPage } from "./pages/FarmRunPage";
import { HistoryPage } from "./pages/HistoryPage";
import { OpenAiPage } from "./pages/OpenAiPage";
import { SmsPage } from "./pages/SmsPage";
import numeroVirtualLogo from "./assets/numero-virtual.png";
import email22doLogo from "./assets/22do.svg";
import adsPowerLogo from "./assets/adspower.svg";
import openAiLogo from "./assets/openai.svg";
import farmLogo from "./assets/farm.svg";
import historyLogo from "./assets/history.svg";

const MENUS: Array<{ id: MenuId; label: string; icon?: string }> = [
  { id: "sms", label: "Número Virtual", icon: numeroVirtualLogo },
  { id: "email", label: "Email (22.do)", icon: email22doLogo },
  { id: "adspower", label: "AdsPower", icon: adsPowerLogo },
  { id: "openai", label: "OpenAI", icon: openAiLogo },
  { id: "farm", label: "Farm de BM", icon: farmLogo },
  { id: "history", label: "Histórico", icon: historyLogo },
];

function desktop(): DesktopApi | undefined {
  return window.desktop;
}

export function App() {
  const [menu, setMenu] = useState<MenuId>("farm");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [smsResult, setSmsResult] = useState<ConnectionResult>();
  const [smsAction, setSmsAction] = useState<ConnectionResult>();
  const [emailResult, setEmailResult] = useState<ConnectionResult>();
  const [emailAction, setEmailAction] = useState<ConnectionResult>();
  const [adsResult, setAdsResult] = useState<ConnectionResult>();
  const [openAiResult, setOpenAiResult] = useState<ConnectionResult>();
  const [adsProfiles, setAdsProfiles] = useState<AdsPowerProfile[]>([]);
  const [adsListError, setAdsListError] = useState<string>();
  const [smsServices, setSmsServices] = useState<SmsService[]>([]);
  const [smsActivation, setSmsActivation] = useState<SmsActivation>();
  const [busy, setBusy] = useState(false);
  const [update, setUpdate] = useState<UpdateCheckResult>();
  const [engine, setEngine] = useState<EngineStatus>({ running: false, mensagem: "Motor ocioso." });
  const [farmRun, setFarmRun] = useState<FarmRunState>({ running: false, batchSize: 1, companies: [], mensagem: "Farm ocioso." });
  const [farmTab, setFarmTab] = useState<string>();
  const [pause, setPause] = useState<HumanPause>();
  const [version, setVersion] = useState("0.1.0");
  const [logs, setLogs] = useState<AppLog[]>([]);

  useEffect(() => {
    void desktop()?.getConfig().then((saved) => {
      if (saved) setConfig({ ...saved, empresas: saved.farm?.started ? saved.empresas ?? [] : [] });
    });
    void desktop()?.getHistory().then(setHistory);
    void desktop()?.engineStatus().then(setEngine);
    void desktop()?.farmState().then((state) => {
      if (state) setFarmRun(state);
    });
    void desktop()?.platform().then((info) => setVersion(info.version));
    void desktop()?.listLogs().then((entries) => setLogs((entries as AppLog[]) ?? []));
    void desktop()?.checkUpdate().then((result) => {
      if (result) setUpdate(result);
    });
    const offLog = desktop()?.onLog((entry) => setLogs((current) => [entry as AppLog, ...current].slice(0, 300)));
    const offPause = desktop()?.onPause((next) => setPause(next as HumanPause));
    const offFarm = desktop()?.onFarmState((state) => {
      setFarmRun(state);
      const attention = state.companies.find((item) => item.attention);
      if (attention) setFarmTab(attention.id);
      void desktop()?.getConfig().then((saved) => {
        if (saved) setConfig((current) => ({ ...saved, empresas: current.empresas }));
      });
    });
    return () => {
      offLog?.();
      offPause?.();
      offFarm?.();
    };
  }, []);

  const persist = useCallback(async (next: AppConfig) => {
    setConfig(next);
    const saved = await desktop()?.saveConfig(settingsToSave(next));
    if (saved) setConfig({ ...saved, empresas: next.empresas });
  }, []);

  const keepDraft = (next: AppConfig) => {
    setConfig(next);
  };

  const applySaved = (saved: AppConfig | undefined) => {
    if (!saved) return;
    setConfig((current) => ({ ...saved, empresas: current.empresas }));
  };

  useEffect(() => {
    let stop = false;
    let adsRunning = false;
    const pollSms = async () => {
      const result = await desktop()?.testSms();
      if (!stop && result) setSmsResult(result);
    };
    const pollEmail = async () => {
      const result = await desktop()?.testEmail();
      if (!stop && result) setEmailResult(result);
    };
    const pollOpenAi = async () => {
      const result = await desktop()?.testOpenAi?.();
      if (!stop && result) setOpenAiResult(result);
    };
    const pollAds = async () => {
      if (adsRunning) return;
      adsRunning = true;
      try {
        const list = await desktop()?.listAdsPowerProfiles();
        if (stop) return;
        if (list) {
          setAdsProfiles(list);
          setAdsListError(undefined);
          setAdsResult({ ok: true, mensagem: `AdsPower local · ${list.length} perfil${list.length === 1 ? "" : "is"}.` });
        }
      } catch (error) {
        if (stop) return;
        const mensagem = error instanceof Error ? error.message : "Falha no AdsPower.";
        if (/too many request/i.test(mensagem)) return;
        setAdsListError(mensagem);
        setAdsResult({ ok: false, mensagem });
      } finally {
        adsRunning = false;
      }
    };
    const poll = async () => {
      await Promise.all([pollSms(), pollEmail(), pollAds(), pollOpenAi()]);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [
    config.sms.apiKey,
    config.sms.baseUrl,
    config.email.token,
    config.email.baseUrl,
    config.adspower.baseUrl,
    config.openai.apiKey,
    config.openai.baseUrl,
  ]);

  useEffect(() => {
    if (menu !== "sms" || !smsResult?.ok) return;
    let stop = false;
    void desktop()
      ?.listSmsServices()
      .then((list) => {
        if (!stop) setSmsServices(list ?? []);
      })
      .catch(() => {
        if (!stop) setSmsServices([]);
      });
    return () => {
      stop = true;
    };
  }, [menu, smsResult?.ok, config.sms.apiKey]);

  const refreshInboxes = useCallback(async () => {
    try {
      await desktop()?.listInboxes();
      const saved = await desktop()?.getConfig();
      applySaved(saved);
    } catch (error) {
      setEmailAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao listar caixas." });
    }
  }, []);

  const openInbox = useCallback(async (address: string) => {
    try {
      await desktop()?.listMail(address);
      const saved = await desktop()?.getConfig();
      applySaved(saved);
    } catch (error) {
      setEmailAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao ler e-mail." });
    }
  }, []);

  const refreshAdsProfiles = useCallback(async () => {
    try {
      const list = await desktop()?.listAdsPowerProfiles();
      if (list) {
        setAdsProfiles(list);
        setAdsListError(undefined);
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Falha ao listar perfis do AdsPower.";
      if (/too many request/i.test(mensagem)) return;
      setAdsListError(mensagem);
    }
  }, []);

  const refreshSmsNumbers = useCallback(async () => {
    try {
      await desktop()?.listSmsNumbers();
      const saved = await desktop()?.getConfig();
      applySaved(saved);
    } catch (error) {
      setSmsAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao listar números." });
    }
  }, []);

  const page = useMemo(() => {
    if (menu === "sms") {
      return (
        <SmsPage
          config={config}
          live={smsResult}
          action={smsAction}
          services={smsServices}
          activation={smsActivation}
          busy={busy}
          onChange={(next) => void persist(next)}
          onListNumbers={refreshSmsNumbers}
          onCreate={async () => {
            setBusy(true);
            try {
              const activation = await desktop()?.createSmsNumber();
              setSmsActivation(activation);
              const saved = await desktop()?.getConfig();
              applySaved(saved);
              setSmsAction({
                ok: true,
                mensagem: activation ? `Número ${activation.phone}${activation.ddd ? ` · DDD ${activation.ddd}` : ""}` : "Número gerado.",
              });
            } catch (error) {
              setSmsAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao gerar número." });
            } finally {
              setBusy(false);
            }
          }}
          onInbox={async (activationId) => {
            setBusy(true);
            try {
              const activation = await desktop()?.readSms(activationId);
              setSmsActivation(activation);
              const saved = await desktop()?.getConfig();
              applySaved(saved);
              const last = [...(activation?.messages ?? [])].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).at(-1);
              setSmsAction({
                ok: true,
                mensagem: last ? `SMS: ${last.code ?? last.text}` : "Número ativo, ainda sem SMS.",
              });
            } catch (error) {
              setSmsAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao ler SMS." });
            } finally {
              setBusy(false);
            }
          }}
          onCancel={async (activationId) => {
            setBusy(true);
            try {
              await desktop()?.cancelSmsNumber(activationId);
              await refreshSmsNumbers();
              setSmsAction({ ok: true, mensagem: "Número cancelado. Reembolso conforme a regra da API." });
            } catch (error) {
              setSmsAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao cancelar número." });
            } finally {
              setBusy(false);
            }
          }}
        />
      );
    }
    if (menu === "email") {
      return (
        <EmailPage
          config={config}
          live={emailResult}
          action={emailAction}
          busy={busy}
          onChange={(next) => void persist(next)}
          onCreate={async () => {
            setBusy(true);
            try {
              const created = await desktop()?.createInbox();
              const saved = await desktop()?.getConfig();
              applySaved(saved);
              setEmailAction({ ok: true, mensagem: created?.address ? `Caixa ${created.address}` : "Caixa gerada." });
            } catch (error) {
              setEmailAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao gerar e-mail." });
            } finally {
              setBusy(false);
            }
          }}
          onDelete={async (address) => {
            setBusy(true);
            try {
              await desktop()?.deleteInbox(address);
              const saved = await desktop()?.getConfig();
              applySaved(saved);
              setEmailAction({ ok: true, mensagem: `Caixa ${address} excluída.` });
            } catch (error) {
              setEmailAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao excluir a caixa." });
            } finally {
              setBusy(false);
            }
          }}
          onListInboxes={refreshInboxes}
          onOpenInbox={openInbox}
        />
      );
    }
    if (menu === "adspower") {
      return (
        <AdsPowerPage
          config={config}
          live={adsResult}
          profiles={adsProfiles}
          listError={adsListError}
          onChange={(next) => void persist(next)}
          onListProfiles={refreshAdsProfiles}
        />
      );
    }
    if (menu === "openai") {
      return <OpenAiPage config={config} live={openAiResult} onChange={(next) => void persist(next)} />;
    }
    if (menu === "history") return <HistoryPage events={history} logs={logs} />;
    return (
      <FarmPage
        config={config}
        profiles={adsProfiles}
        onChange={keepDraft}
        onRemove={(id) => keepDraft({ ...config, empresas: config.empresas.filter((item) => item.id !== id) })}
        onStartFarm={async () => {
          const next = {
            ...config,
            farm: { ...config.farm, started: true, batchSize: config.farm.batchSize },
          };
          await persist(next);
          const state = await desktop()?.startFarm(next.empresas, next.farm.batchSize);
          if (state) {
            setFarmRun(state);
            setFarmTab(state.companies[0]?.id);
            setMenu("farm");
          }
        }}
        onPickDocument={async (id) => {
          const card = config.empresas.find((item) => item.id === id);
          const picked = await desktop()?.pickEmpresaDocument(Boolean(card?.ler_pdf_automatico));
          if (!picked) return;
          keepDraft({
            ...config,
            empresas: config.empresas.map((item) => (item.id === id ? { ...item, documento_original: picked.path, ...picked.fields } : item)),
          });
        }}
      />
    );
  }, [adsListError, adsProfiles, adsResult, busy, config, emailAction, emailResult, farmRun, farmTab, history, logs, menu, openAiResult, openInbox, persist, refreshAdsProfiles, refreshInboxes, refreshSmsNumbers, smsAction, smsActivation, smsResult, smsServices]);

  const farmLocked = farmNeedsReview(farmRun);

  return (
    <div className={`app${farmLocked ? " farm-locked" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <strong>BM Farm</strong>
          <span>v{version} · AdsPower + Electron</span>
        </div>
        <nav className="nav">
          {MENUS.map((item) => (
            <button
              key={item.id}
              className={menu === item.id ? "active" : ""}
              type="button"
              disabled={farmLocked}
              onClick={() => setMenu(item.id)}
            >
              {item.icon ? <img className="nav-logo" src={item.icon} alt="" /> : null}
              {item.label}
              {navShowsIntegrationAlert(item.id, { sms: smsResult, email: emailResult, adspower: adsResult, openai: openAiResult }) ? (
                <span className="attention" aria-label="integração falhou">
                  !
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="card">
          <strong>Atualização</strong>
          <p className="muted">{update?.mensagem ?? "Checando atualização…"}</p>
          {update?.newer ? (
            <div className="row">
              <button className="btn" type="button" onClick={() => void desktop()?.applyUpdate()}>
                Instalar
              </button>
            </div>
          ) : null}
        </div>
      </aside>
      <main className="workspace">
        {farmLocked ? (
          <FarmRunPage
            state={farmRun}
            selectedId={farmTab}
            onSelect={setFarmTab}
            onStop={async () => {
              const state = await desktop()?.stopFarm();
              if (state) setFarmRun(state);
              setPause(undefined);
            }}
            onResume={async (pauseId) => {
              await desktop()?.resumeHuman(pauseId);
              setPause(undefined);
            }}
            onReport={async (empresaId) => {
              const state = await desktop()?.reportFarmScreen(empresaId);
              if (state) setFarmRun(state);
              setPause(undefined);
            }}
            onDismiss={async (empresaId) => {
              const state = await desktop()?.dismissFarmCompany(empresaId);
              if (state) setFarmRun(state);
            }}
            onDismissAll={async () => {
              const state = await desktop()?.dismissFarm();
              if (state) setFarmRun(state);
            }}
          />
        ) : (
          page
        )}
      </main>
      {pause && !farmLocked ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Pausa humana</h2>
            <p>{pause.message}</p>
            <div className="row">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  void desktop()?.resumeHuman(pause.id);
                  setPause(undefined);
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
