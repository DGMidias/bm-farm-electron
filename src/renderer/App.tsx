import type { DesktopApi } from "../preload";
import { DEFAULT_CONFIG, type AppConfig, type ConnectionResult, type EngineStatus, type HistoryEvent, type HumanPause, type MailMessage, type MenuId, type UpdateCheckResult } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { AdsPowerPage } from "./pages/AdsPowerPage";
import { EmailPage } from "./pages/EmailPage";
import { FarmPage } from "./pages/FarmPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SmsPage } from "./pages/SmsPage";

const MENUS: Array<{ id: MenuId; label: string }> = [
  { id: "sms", label: "1 · SMS" },
  { id: "email", label: "2 · E-mail" },
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
  const [adsResult, setAdsResult] = useState<ConnectionResult>();
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [update, setUpdate] = useState<UpdateCheckResult>();
  const [engine, setEngine] = useState<EngineStatus>({ running: false, mensagem: "Motor ocioso." });
  const [pause, setPause] = useState<HumanPause>();
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    void desktop()?.getConfig().then(setConfig);
    void desktop()?.getHistory().then(setHistory);
    void desktop()?.engineStatus().then(setEngine);
    void desktop()?.platform().then((info) => setVersion(info.version));
    return desktop()?.onPause((next) => setPause(next as HumanPause));
  }, []);

  const persist = async (next: AppConfig) => {
    setConfig(next);
    const saved = await desktop()?.saveConfig(next);
    if (saved) setConfig(saved);
  };

  const page = useMemo(() => {
    if (menu === "sms") {
      return (
        <SmsPage
          config={config}
          result={smsResult}
          onChange={(next) => void persist(next)}
          onTest={async () => setSmsResult(await desktop()?.testSms())}
        />
      );
    }
    if (menu === "email") {
      return (
        <EmailPage
          config={config}
          messages={messages}
          onChange={(next) => void persist(next)}
          onCreate={async () => {
            const created = await desktop()?.createInbox();
            if (created?.address) {
              setConfig((current) => ({ ...current, email: { ...current.email, lastAddress: created.address } }));
            }
            setMessages(created?.messages ?? []);
          }}
          onRefresh={async () => setMessages((await desktop()?.listMail()) ?? [])}
        />
      );
    }
    if (menu === "adspower") {
      return (
        <AdsPowerPage
          config={config}
          result={adsResult}
          onChange={(next) => void persist(next)}
          onTest={async () => setAdsResult(await desktop()?.testAdsPower())}
        />
      );
    }
    if (menu === "history") return <HistoryPage events={history} />;
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
  }, [adsResult, config, engine, history, menu, messages, smsResult]);

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
