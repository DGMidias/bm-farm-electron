import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";
import { joinPath } from "@harness/compat";
import { buildCapture, shouldSkipDuplicate, type CaptureLabel, type CaptureMeta, type CaptureReason } from "@shared/page-capture";
import type { ScreenSnapshot } from "@shared/types";

export async function labelsFromPage(page: Page): Promise<CaptureLabel[]> {
  return page.evaluate(() => {
    const items: CaptureLabel[] = [];
    const nodes = document.querySelectorAll("input, textarea, button, select, [role], [aria-label], [placeholder]");
    for (const node of nodes) {
      const element = node as HTMLElement;
      const role = element.getAttribute("role") || element.tagName.toLowerCase();
      const name = (
        element.getAttribute("aria-label") ||
        element.getAttribute("placeholder") ||
        element.getAttribute("name") ||
        element.innerText ||
        ""
      ).trim();
      if (role && name) items.push({ role, name: name.slice(0, 80) });
    }
    return items.slice(0, 80);
  });
}

export async function snapshotFromPage(page: Page): Promise<ScreenSnapshot> {
  const texts = (await page.locator("body").innerText().catch(() => ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
  const labels = await labelsFromPage(page).catch(() => []);
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    texts,
    roles: labels.map((item) => item.role),
  };
}

export async function captureFromPage(page: Page, screenId: string, reason: CaptureReason = "auto"): Promise<CaptureMeta> {
  const snapshot = await snapshotFromPage(page);
  const labels = await labelsFromPage(page).catch(() => []);
  return buildCapture({
    url: snapshot.url,
    title: snapshot.title,
    screenId,
    reason,
    texts: snapshot.texts,
    labels,
  });
}

function knownFingerprints(screenDir: string): Set<string> {
  const found = new Set<string>();
  if (!existsSync(screenDir)) return found;
  for (const stamp of readdirSync(screenDir)) {
    const meta = joinPath(screenDir, stamp, "meta.json");
    if (!existsSync(meta)) continue;
    try {
      const parsed = JSON.parse(readFileSync(meta, "utf8")) as CaptureMeta;
      if (parsed.fingerprint) found.add(parsed.fingerprint);
    } catch {
      /* ignore broken capture */
    }
  }
  return found;
}

export async function savePageCapture(
  capturesRoot: string,
  page: Page,
  screenId: string,
  options: { screenshot?: boolean; reason?: CaptureReason } = {},
): Promise<{ saved: boolean; fingerprint: string; dir?: string; screenId: string }> {
  const reason = options.reason ?? "auto";
  const screenshot = options.screenshot ?? true;
  const meta = await captureFromPage(page, screenId, reason);
  const screenDir = joinPath(capturesRoot, screenId.replace(/\W+/g, "_"));
  if (shouldSkipDuplicate(reason, knownFingerprints(screenDir).has(meta.fingerprint))) {
    return { saved: false, fingerprint: meta.fingerprint, screenId };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = joinPath(screenDir, stamp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(joinPath(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  try {
    writeFileSync(joinPath(dir, "dom.html"), await page.content(), "utf8");
  } catch {
    /* HTML is optional when the page already closed */
  }
  if (screenshot) {
    try {
      await page.screenshot({ path: joinPath(dir, "screen.png"), fullPage: false });
    } catch {
      /* screenshot is optional */
    }
  }
  return { saved: true, fingerprint: meta.fingerprint, dir, screenId };
}
