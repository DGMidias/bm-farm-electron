import { emptyEmpresa, validCnpj, validateEmpresa } from "@shared/empresa";
import { describe, expect, it } from "vitest";

describe("empresa", () => {
  it("valida CNPJ conhecido", () => {
    expect(validCnpj("51.449.498/0001-05")).toBe(true);
    expect(validCnpj("00000000000000")).toBe(false);
  });

  it("exige perfil AdsPower e HTTPS", () => {
    const card = emptyEmpresa("1");
    card.razao_social = "X";
    card.cnpj = "51.449.498/0001-05";
    card.responsavel = "A";
    card.email_comercial = "a@b.com";
    card.endereco = "Rua 1";
    card.cidade = "Joinville";
    card.estado = "SC";
    card.cep = "89201000";
    card.telefone = "47999887766";
    card.site = "https://exemplo.com";
    card.adspower_profile = "2";
    expect(validateEmpresa(card)).toEqual([]);
    card.site = "http://exemplo.com";
    expect(validateEmpresa(card).join(" ")).toMatch(/HTTPS/);
  });
});
