import type { EmpresaCard } from "./empresa";

export type MenuId = "sms" | "email" | "adspower" | "farm" | "history";

export interface SmsConfig {
  baseUrl: string;
  apiKey: string;
  countryCode: string;
  serviceCode: string;
  serviceId: string;
  apiId: string;
  ddd: string;
  lastActivationId: string;
  lastPhone: string;
  knownActivations: SmsActivation[];
  activationChanges: SmsActivationChange[];
}

export interface EmailConfig {
  provider: "mail.tm";
  password: string;
  lastAddress: string;
  lastToken: string;
  knownInboxes: MailInbox[];
}

export interface AdsPowerConfig {
  baseUrl: string;
  apiKey: string;
  testProfile: string;
}

export interface AdsPowerProfile {
  userId: string;
  serial?: string;
  name?: string;
  groupName?: string;
  username?: string;
  domain?: string;
  remark?: string;
  ip?: string;
  ipCountry?: string;
  createdAt?: string;
  lastOpenAt?: string;
  status?: string;
}

export interface UpdateConfig {
  latestUrl: string;
}

export interface FarmUiConfig {
  lastPdfDir: string;
  batchSize: number;
  started: boolean;
}

export interface AppConfig {
  sms: SmsConfig;
  email: EmailConfig;
  adspower: AdsPowerConfig;
  update: UpdateConfig;
  farm: FarmUiConfig;
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

export type LogLevel = "error" | "warn" | "info";

export interface AppLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
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
  empresaId?: string;
  reason: "captcha" | "otp" | "envio" | "unknown_screen" | "login";
  message: string;
  screenshotDataUrl?: string;
}

export type FarmCompanyStatus = "idle" | "running" | "paused" | "ok" | "erro";

export interface FarmEvent {
  id: string;
  timestamp: string;
  empresaId?: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface FarmCompanyRun {
  id: string;
  razaoSocial: string;
  status: FarmCompanyStatus;
  attention: boolean;
  dismissed?: boolean;
  pause?: HumanPause;
  logs: FarmEvent[];
}

export interface FarmRunState {
  running: boolean;
  batchSize: number;
  companies: FarmCompanyRun[];
  mensagem: string;
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
  receivedAt?: string;
  seenAt?: string;
  code?: string;
  link?: string;
}

export interface MailInbox {
  id: string;
  address: string;
  token: string;
  password: string;
  createdAt: string;
  active: boolean;
  lastCheckedAt?: string;
  empresaId?: string;
  razaoSocial?: string;
  adspowerProfile?: string;
  messages: MailMessage[];
}

export interface SmsMessage {
  id: string;
  text: string;
  code?: string;
  receivedAt: string;
}

export interface SmsActivation {
  id: string;
  phone: string;
  status: string;
  ddd?: string;
  expiresAt?: string;
  createdAt?: string;
  serviceName?: string;
  optionLabel?: string;
  apiId?: string;
  messages: SmsMessage[];
}

export interface SmsActivationChange {
  id: string;
  activationId: string;
  timestamp: string;
  field: string;
  from: string;
  to: string;
}

export interface SmsServiceOption {
  apiId: string;
  name: string;
  price?: string;
  priceFormatted?: string;
  available?: number;
  allowsDdd: boolean;
}

export interface SmsService {
  id: string;
  code: string;
  name: string;
  price?: string;
  options: SmsServiceOption[];
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
    baseUrl: "https://app.numero-virtual.com/api/v1",
    apiKey: "",
    countryCode: "BR",
    serviceCode: "fb",
    serviceId: "60033",
    apiId: "",
    ddd: "35",
    lastActivationId: "",
    lastPhone: "",
    knownActivations: [],
    activationChanges: [],
  },
  email: {
    provider: "mail.tm",
    password: "",
    lastAddress: "",
    lastToken: "",
    knownInboxes: [],
  },
  adspower: {
    baseUrl: "http://127.0.0.1:50325",
    apiKey: "",
    testProfile: "",
  },
  update: {
    latestUrl: "",
  },
  farm: {
    lastPdfDir: "",
    batchSize: 1,
    started: false,
  },
  empresas: [],
};
