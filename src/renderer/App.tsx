import type { DesktopApi } from "../preload";
import { settingsToSave } from "@shared/farm-draft";
import { DEFAULT_CONFIG, type AdsPowerProfile, type AppConfig, type AppLog, type ConnectionResult, type EngineStatus, type HistoryEvent, type HumanPause, type MenuId, type SmsActivation, type SmsService, type UpdateCheckResult } from "@shared/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdsPowerPage } from "./pages/AdsPowerPage";
import { EmailPage } from "./pages/EmailPage";
import { FarmPage } from "./pages/FarmPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SmsPage } from "./pages/SmsPage";
import numeroVirtualLogo from "./assets/numero-virtual.png";
import mailTmLogo from "./assets/mail-tm.svg";
import adsPowerLogo from "./assets/adspower.svg";
import farmLogo from "./assets/farm.svg";
import historyLogo from "./assets/history.svg";

const MENUS: Array<{ id: MenuId; label: string; icon?: string }> = [
  { id: "sms", label: "Número Virtual", icon: numeroVirtualLogo },
  { id: "email", label: "Email (mail.tm)", icon: mailTmLogo },
  { id: "adspower", label: "AdsPower", icon: adsPowerLogo },
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
  const [adsProfiles, setAdsProfiles] = useState<AdsPowerProfile[]>([]);
  const [adsListError, setAdsListError] = useState<string>();
  const [smsServices, setSmsServices] = useState<SmsService[]>([]);
  const [smsActivation, setSmsActivation] = useState<SmsActivation>();
  const [busy, setBusy] = useState(false);
  const [update, setUpdate] = useState<UpdateCheckResult>();
  const [engine, setEngine] = useState<EngineStatus>({ running: false, mensagem: "Motor ocioso." });
  const [pause, setPause] = useState<HumanPause>();
  const [version, setVersion] = useState("0.1.0");
  const [logs, setLogs] = useState<AppLog[]>([]);

  useEffect(() => {
    void desktop()?.getConfig().then((saved) => {
      if (saved) setConfig({ ...saved, empresas: [] });
    });
    void desktop()?.getHistory().then(setHistory);
    void desktop()?.engineStatus().then(setEngine);
    void desktop()?.platform().then((info) => setVersion(info.version));
    void desktop()?.listLogs().then((entries) => setLogs((entries as AppLog[]) ?? []));
    void desktop()?.checkUpdate().then((result) => {
      if (result) setUpdate(result);
    });
    const offLog = desktop()?.onLog((entry) => setLogs((current) => [entry as AppLog, ...current].slice(0, 300)));
    const offPause = desktop()?.onPause((next) => setPause(next as HumanPause));
    return () => {
      offLog?.();
      offPause?.();
    };
  }, []);

  const persist = async (next: AppConfig) => {
    setConfig(next);
    const saved = await desktop()?.saveConfig(settingsToSave(next));
    if (saved) setConfig({ ...saved, empresas: next.empresas });
  };

  const keepDraft = (next: AppConfig) => {
    setConfig(next);
  };

  const applySaved = (saved: AppConfig | undefined) => {
    if (!saved) return;
    setConfig((current) => ({ ...saved, empresas: current.empresas }));
  };

  useEffect(() => {
    if (menu !== "sms") return;
    let stop = false;
    const poll = async () => {
      const result = await desktop()?.testSms();
      if (stop || !result) return;
      setSmsResult(result);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [menu, config.sms.apiKey, config.sms.baseUrl]);

  useEffect(() => {
    if (menu !== "email") return;
    let stop = false;
    const poll = async () => {
      const result = await desktop()?.testEmail();
      if (stop || !result) return;
      setEmailResult(result);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [menu]);

  useEffect(() => {
    if (menu !== "adspower") return;
    let stop = false;
    const poll = async () => {
      const result = await desktop()?.testAdsPower();
      if (stop || !result) return;
      setAdsResult(result);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [menu, config.adspower.apiKey, config.adspower.baseUrl]);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const list = await desktop()?.listAdsPowerProfiles();
        if (!stop) setAdsProfiles(list ?? []);
      } catch {
        if (!stop) setAdsProfiles([]);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [config.adspower.apiKey, config.adspower.baseUrl]);

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
      setAdsProfiles(list ?? []);
      setAdsListError(undefined);
    } catch (error) {
      setAdsProfiles([]);
      setAdsListError(error instanceof Error ? error.message : "Falha ao listar perfis do AdsPower.");
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
    if (menu === "history") return <HistoryPage events={history} logs={logs} />;
    return (
      <FarmPage
        config={config}
        engine={engine}
        profiles={adsProfiles}
        onChange={keepDraft}
        onRemove={(id) => keepDraft({ ...config, empresas: config.empresas.filter((item) => item.id !== id) })}
        onStart={async (id) => {
          const card = config.empresas.find((item) => item.id === id);
          setEngine(await desktop()?.startSession(id, card));
        }}
        onFill={async (id, step) => {
          const card = config.empresas.find((item) => item.id === id);
          await desktop()?.fillStep(id, step, card);
        }}
        onDetect={async () => {
          const detected = await desktop()?.detectScreen();
          if (detected?.nodeId) setEngine((current) => ({ ...current, screen: detected.nodeId, mensagem: `Tela ${detected.nodeId}` }));
        }}
        onStop={async () => setEngine(await desktop()?.stopSession())}
        onSaveSnapshot={async (name) => {
          await desktop()?.saveSnapshot(name);
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
  }, [adsListError, adsProfiles, adsResult, busy, config, emailAction, emailResult, engine, history, logs, menu, openInbox, refreshAdsProfiles, refreshInboxes, refreshSmsNumbers, smsAction, smsActivation, smsResult, smsServices]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <strong>BM Farm</strong>
          <span>v{version} · AdsPower + Electron</span>
        </div>
        <nav className="nav">
          {MENUS.map((item) => (
            <button key={item.id} className={menu === item.id ? "active" : ""} type="button" onClick={() => setMenu(item.id)}>
              {item.icon ? <img className="nav-logo" src={item.icon} alt="" /> : null}
              {item.label}
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
      <main className="workspace">{page}</main>
      {pause ? (
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
