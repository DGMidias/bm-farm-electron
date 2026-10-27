export type CaptureReason = "auto" | "error" | "operator";

export interface CaptureLabel {
  role: string;
  name: string;
}

export interface CaptureMeta {
  url: string;
  title: string;
  fingerprint: string;
  screenId: string;
  reason: CaptureReason;
  capturedAt: string;
  labels: CaptureLabel[];
  anyText: string[];
}

export function shouldSkipDuplicate(reason: CaptureReason | undefined, known: boolean): boolean {
  if (reason === "error" || reason === "operator") return false;
  return known;
}

export function fingerprintOf(texts: string[], labels: string[]): string {
  const blob = [...texts, ...labels]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < blob.length; index += 1) {
    hash ^= blob.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildCapture(input: {
  url: string;
  title: string;
  screenId: string;
  texts: string[];
  labels: CaptureLabel[];
  reason?: CaptureReason;
  capturedAt?: string;
}): CaptureMeta {
  const anyText = input.texts.map((item) => item.trim()).filter(Boolean).slice(0, 80);
  const labels = input.labels
    .map((item) => ({ role: item.role.trim(), name: item.name.trim().slice(0, 80) }))
    .filter((item) => item.role && item.name)
    .slice(0, 80);
  return {
    url: input.url,
    title: input.title,
    screenId: input.screenId,
    reason: input.reason ?? "auto",
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    anyText,
    labels,
    fingerprint: fingerprintOf(anyText, labels.map((item) => `${item.role}:${item.name}`)),
  };
}
