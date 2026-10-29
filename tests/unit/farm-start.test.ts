import { emptyEmpresa, validCnpj, validateEmpresa, validateFarmStart } from "@shared/empresa";
import { describe, expect, it } from "vitest";

function readyCard(id: string, profile = id): ReturnType<typeof emptyEmpresa> {
  const card = emptyEmpresa(id);
  card.razao_social = "Vesol Energia Solar Ltda";
  card.cnpj = "51.449.498/0001-05";
  card.email_comercial = "rafaela@vesol.com.br";
  card.endereco = "R Jose Theodoro Ribeiro, 2723";
  card.cidade = "Jaragua do Sul";
  card.estado = "SC";
  card.cep = "89258001";
  card.telefone = "4732043799";
  card.site = "https://www.vesol.com.br";
  card.adspower_profile = profile;
  card.documento_original = "C:/tmp/download.pdf";
  card.autorizado_pela_empresa = true;
  card.documento_sem_alteracao_de_conteudo = true;
  return card;
}

describe("validação para iniciar o farm", () => {
  it("ainda aceita CNPJ conhecido", () => {
    expect(validCnpj("51.449.498/0001-05")).toBe(true);
  });

  it("bloqueia card incompleto e site vazio, mas o e-mail do card não é obrigatório", () => {
    const card = emptyEmpresa("e1");
    card.site = "https://";
    const errors = validateEmpresa(card);
    expect(errors.join(" ")).toMatch(/obrigatório/i);
    expect(errors.join(" ")).toMatch(/site/i);
    card.razao_social = "X";
    card.cnpj = "51.449.498/0001-05";
    card.endereco = "Rua 1";
    card.cidade = "Joinville";
    card.estado = "SC";
    card.cep = "89201000";
    card.site = "https://exemplo.com";
    card.adspower_profile = "2";
    card.documento_original = "C:/tmp/cnpj.pdf";
    card.autorizado_pela_empresa = true;
    card.documento_sem_alteracao_de_conteudo = true;
    expect(card.telefone).toBe("");
    expect(validateEmpresa(card)).toEqual([]);
    expect(validateFarmStart([card], ["2"])).toEqual([]);
  });

  it("bloqueia lote com perfil duplicado, CNPJ repetido ou card inválido", () => {
    const a = readyCard("e1", "2");
    const b = readyCard("e2", "2");
    b.cnpj = "46.971.233/0001-32";
    expect(validateFarmStart([a, b], ["2", "1"]).join(" ")).toMatch(/perfil/i);
    b.adspower_profile = "1";
    b.cnpj = a.cnpj;
    expect(validateFarmStart([a, b], ["2", "1"]).join(" ")).toMatch(/CNPJ/i);
    b.cnpj = "46.971.233/0001-32";
    expect(validateFarmStart([a, b], ["2"]).join(" ")).toMatch(/perfil/i);
    expect(validateFarmStart([a, b], ["2", "1"])).toEqual([]);
  });
});
