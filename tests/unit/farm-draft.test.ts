import { DEFAULT_CONFIG } from "@shared/types";
import { settingsToSave } from "@shared/farm-draft";
import { emptyEmpresa } from "@shared/empresa";
import { describe, expect, it } from "vitest";

describe("rascunho do farm", () => {
  it("não grava empresas até iniciar o farm", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.empresas = [emptyEmpresa("e1")];
    config.sms.apiKey = "k";
    const saved = settingsToSave(config);
    expect(saved.empresas).toEqual([]);
    expect(saved.sms.apiKey).toBe("k");
    expect(config.empresas).toHaveLength(1);
  });

  it("grava empresas depois que o farm começa", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.empresas = [emptyEmpresa("e1")];
    config.farm.started = true;
    expect(settingsToSave(config).empresas).toHaveLength(1);
  });
});
