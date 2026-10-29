import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { joinPath } from "@harness/compat";
import { DEFAULT_CONFIG } from "@shared/types";
import { LocalStore } from "../../src/main/store";
import { describe, expect, it } from "vitest";

describe("store IPC local", () => {
  it("grava config no userData injetado e não devolve chave inteira no redact", () => {
    const root = mkdtempSync(joinPath(tmpdir(), "bm-store-"));
    const store = new LocalStore({ root });
    const config = structuredClone(DEFAULT_CONFIG);
    config.sms.apiKey = "supersecreta123";
    config.empresas = [{ id: "e1" } as never];
    store.writeConfig(config);
    expect(store.readConfig().sms.apiKey).toBe("supersecreta123");
    expect(store.readConfig().empresas).toEqual([]);
    config.farm.started = true;
    store.writeConfig(config);
    expect(store.readConfig().empresas).toHaveLength(1);
    expect(store.redactForLog("supersecreta123")).not.toContain("supersecreta");
    store.appendHistory({
      id: "1",
      timestamp: new Date().toISOString(),
      empresaId: "e",
      razaoSocial: "X",
      cnpj: "1",
      adspowerProfile: "2",
      etapa: "empresa",
      status: "ok",
      mensagem: "ok",
    });
    expect(store.readHistory()).toHaveLength(1);
  });

  it("descarta API key antiga do AdsPower", () => {
    const root = mkdtempSync(joinPath(tmpdir(), "bm-store-"));
    const store = new LocalStore({ root });
    writeFileSync(
      joinPath(root, "config.json"),
      JSON.stringify({
        ...DEFAULT_CONFIG,
        adspower: { ...DEFAULT_CONFIG.adspower, apiKey: "rotativa-velha" },
      }),
    );
    expect(store.readConfig().adspower).not.toHaveProperty("apiKey");
  });
});
