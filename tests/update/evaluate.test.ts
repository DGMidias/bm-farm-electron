import { DEFAULT_LATEST_URL, evaluateUpdate, resolveLatestUrl } from "@shared/update";
import { describe, expect, it } from "vitest";

const latest = {
  version: "1.2.0",
  notes: "harness",
  win: { url: "https://example.com/Setup.exe", sha512: "abc" },
  mac: { url: "https://example.com/app-mac.zip", sha512: "def" },
};

describe("update", () => {
  it("Windows pega .exe e Mac pega .zip", () => {
    const win = evaluateUpdate("0.1.0", latest, "win32");
    const mac = evaluateUpdate("0.1.0", latest, "darwin");
    expect(win.artifactUrl).toMatch(/\.exe$/);
    expect(mac.artifactUrl).toMatch(/\.zip$/);
  });

  it("recusa hash vazio", () => {
    const result = evaluateUpdate("0.1.0", { ...latest, win: { url: "https://x/a.exe", sha512: "" } }, "win32");
    expect(result.artifactUrl).toBeUndefined();
    expect(result.reason).toMatch(/hash/i);
  });

  it("não atualiza se a versão local já é maior", () => {
    expect(evaluateUpdate("2.0.0", latest, "win32").newer).toBe(false);
  });

  it("usa o latest.json do GitHub Releases quando a URL local está vazia", () => {
    expect(resolveLatestUrl("")).toBe(DEFAULT_LATEST_URL);
    expect(DEFAULT_LATEST_URL).toBe("https://github.com/DGMidias/bm-farm-electron/releases/latest/download/latest.json");
    expect(resolveLatestUrl("https://exemplo.com/latest.json")).toBe("https://exemplo.com/latest.json");
  });
});
