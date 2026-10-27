import type { DesktopApi } from "../preload";
import { DEFAULT_CONFIG, type AppConfig, type AppLog, type ConnectionResult, type EngineStatus, type HistoryEvent, type HumanPause, type MenuId, type SmsActivation, type SmsService, type UpdateCheckResult } from "@shared/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdsPowerPage } from "./pages/AdsPowerPage";
import { EmailPage } from "./pages/EmailPage";
import { FarmPage } from "./pages/FarmPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SmsPage } from "./pages/SmsPage";
import numeroVirtualLogo from "./assets/numero-virtual.png";
import mailTmLogo from "./assets/mail-tm.svg";

const MENUS: Array<{ id: MenuId; label: string; icon?: string }> = [
  { id: "sms", label: "Número Virtual", icon: numeroVirtualLogo },
  { id: "email", label: "Email (mail.tm)", icon: mailTmLogo },
  { id: "adspower", label: "3 · AdsPower" },
  { id: "farm", label: "4 · Farm de BM" },
  { id: "history", label: "5 · Histórico" },
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
  const [smsServices, setSmsServices] = useState<SmsService[]>([]);
  const [smsActivation, setSmsActivation] = useState<SmsActivation>();
  const [busy, setBusy] = useState(false);
  const [update, setUpdate] = useState<UpdateCheckResult>();
  const [engine, setEngine] = useState<EngineStatus>({ running: false, mensagem: "Motor ocioso." });
  const [pause, setPause] = useState<HumanPause>();
  const [version, setVersion] = useState("0.1.0");
  const [logs, setLogs] = useState<AppLog[]>([]);

  useEffect(() => {
    void desktop()?.getConfig().then(setConfig);
    void desktop()?.getHistory().then(setHistory);
    void desktop()?.engineStatus().then(setEngine);
    void desktop()?.platform().then((info) => setVersion(info.version));
    void desktop()?.listLogs().then((entries) => setLogs((entries as AppLog[]) ?? []));
    const offLog = desktop()?.onLog((entry) => setLogs((current) => [entry as AppLog, ...current].slice(0, 300)));
    const offPause = desktop()?.onPause((next) => setPause(next as HumanPause));
    return () => {
      offLog?.();
      offPause?.();
    };
  }, []);

  const persist = async (next: AppConfig) => {
    setConfig(next);
    const saved = await desktop()?.saveConfig(next);
    if (saved) setConfig(saved);
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
      if (saved) setConfig(saved);
    } catch (error) {
      setEmailAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao listar caixas." });
    }
  }, []);

  const openInbox = useCallback(async (address: string) => {
    try {
      await desktop()?.listMail(address);
      const saved = await desktop()?.getConfig();
      if (saved) setConfig(saved);
    } catch (error) {
      setEmailAction({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao ler e-mail." });
    }
  }, []);

  const refreshSmsNumbers = useCallback(async () => {
    try {
      await desktop()?.listSmsNumbers();
      const saved = await desktop()?.getConfig();
      if (saved) setConfig(saved);
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
              if (saved) setConfig(saved);
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
              if (saved) setConfig(saved);
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
              if (saved) setConfig(saved);
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
          result={adsResult}
          engine={engine}
          busy={busy}
          onChange={(next) => void persist(next)}
          onTest={async () => setAdsResult(await desktop()?.testAdsPower())}
          onProbe={async () => {
            setBusy(true);
            try {
              const status = await desktop()?.probeAdsPower();
              if (status) setEngine(status);
              setAdsResult({ ok: true, mensagem: status?.mensagem ?? "Navegador sob controle via CDP." });
            } catch (error) {
              setAdsResult({ ok: false, mensagem: error instanceof Error ? error.message : "Falha ao controlar o AdsPower." });
            } finally {
              setBusy(false);
            }
          }}
          onStop={async () => {
            setBusy(true);
            try {
              setEngine((await desktop()?.stopSession()) ?? { running: false, mensagem: "Motor ocioso." });
              setAdsResult({ ok: true, mensagem: "Sessão AdsPower encerrada." });
            } finally {
              setBusy(false);
            }
          }}
        />
      );
    }
    if (menu === "history") return <HistoryPage events={history} logs={logs} />;
    return (
      <FarmPage
        config={config}
        engine={engine}
        onChange={(next) => void persist(next)}
        onStart={async (id) => setEngine(await desktop()?.startSession(id))}
        onFill={async (id, step) => {
          await desktop()?.fillStep(id, step);
        }}
        onDetect={async () => {
          const detected = await desktop()?.detectScreen();
          if (detected?.nodeId) setEngine((current) => ({ ...current, screen: detected.nodeId, mensagem: `Tela ${detected.nodeId}` }));
        }}
        onStop={async () => setEngine(await desktop()?.stopSession())}
        onSaveSnapshot={async (name) => {
          await desktop()?.saveSnapshot(name);
        }}
      />
    );
  }, [adsResult, busy, config, emailAction, emailResult, engine, history, logs, menu, openInbox, refreshInboxes, refreshSmsNumbers, smsAction, smsActivation, smsResult, smsServices]);

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
          <p className="muted">{update?.mensagem ?? "Ainda não verificada."}</p>
          <div className="row">
            <button className="btn secondary" type="button" onClick={async () => setUpdate(await desktop()?.checkUpdate())}>
              Verificar
            </button>
            {update?.newer ? (
              <button className="btn" type="button" onClick={() => void desktop()?.applyUpdate()}>
                Instalar
              </button>
            ) : null}
          </div>
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
