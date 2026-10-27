import { emptyEmpresa, validCnpj, validateEmpresa } from "@shared/empresa";
import { describe, expect, it } from "vitest";

describe("empresa", () => {
  it("já nasce com e-mail temporário ligado na etapa 1", () => {
    expect(emptyEmpresa().usar_email_temporario).toBe(true);
  });

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
    card.documento_original = "C:/tmp/cnpj.pdf";
    card.autorizado_pela_empresa = true;
    card.documento_sem_alteracao_de_conteudo = true;
    expect(validateEmpresa(card)).toEqual([]);
    card.site = "http://exemplo.com";
    expect(validateEmpresa(card).join(" ")).toMatch(/HTTPS/);
  });
});
