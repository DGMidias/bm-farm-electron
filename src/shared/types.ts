import type { EmpresaCard } from "./empresa";

export type MenuId = "sms" | "email" | "adspower" | "farm" | "history";

export interface SmsConfig {
  baseUrl: string;
  apiKey: string;
}

export interface EmailConfig {
  provider: "mail.tm";
  password: string;
  lastAddress: string;
  lastToken: string;
}

export interface AdsPowerConfig {
  baseUrl: string;
  apiKey: string;
}

export interface UpdateConfig {
  latestUrl: string;
}

export interface AppConfig {
  sms: SmsConfig;
  email: EmailConfig;
  adspower: AdsPowerConfig;
  update: UpdateConfig;
  empresas: EmpresaCard[];
}

export type HistoryStatus = "rascunho" | "em_andamento" | "pausado_humano" | "ok" | "erro";

export interface HistoryEvent {
  id: string;
  timestamp: string;
  empresaId: string;
  razaoSocial: string;
  cnpj: string;
  adspowerProfile: string;
  etapa: string;
  status: HistoryStatus;
  mensagem: string;
}

export interface ConnectionResult {
  ok: boolean;
  mensagem: string;
}

export interface UpdateCheckResult {
  current: string;
  remote?: string;
  newer: boolean;
  notes?: string;
  artifactUrl?: string;
  mensagem: string;
}

export interface HumanPause {
  id: string;
  reason: "captcha" | "otp" | "envio" | "unknown_screen" | "login";
  message: string;
  screenshotDataUrl?: string;
}

export interface EngineStatus {
  running: boolean;
  profile?: string;
  screen?: string;
  pause?: HumanPause;
  mensagem: string;
}

export interface MailMessage {
  id: string;
  from: string;
  subject: string;
  intro: string;
}

export interface ScreenSnapshot {
  url: string;
  title: string;
  texts: string[];
  roles: string[];
  classifiedAs?: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  sms: {
    baseUrl: "https://app.numero-virtual.com.br",
    apiKey: "",
  },
  email: {
    provider: "mail.tm",
    password: "",
    lastAddress: "",
    lastToken: "",
  },
  adspower: {
    baseUrl: "http://127.0.0.1:50325",
    apiKey: "",
  },
  update: {
    latestUrl: "",
  },
  empresas: [],
};
