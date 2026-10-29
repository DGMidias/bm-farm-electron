import { emptyEmpresa, mergeEmpresaBusinessIds, validCnpj, validateEmpresa, withEmpresaBusinessId } from "@shared/empresa";
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
    expect(card.responsavel).toBe("");
    expect(validateEmpresa(card)).toEqual([]);
    card.site = "http://exemplo.com";
    expect(validateEmpresa(card).join(" ")).toMatch(/HTTPS/);
  });

  it("grava business_id só no card da empresa", () => {
    const solfacil = emptyEmpresa("sol");
    const vesol = emptyEmpresa("ves");
    vesol.business_id = "16184247566784500";
    const next = withEmpresaBusinessId([solfacil, vesol], "sol", "39710179128628335");
    expect(next.find((item) => item.id === "sol")?.business_id).toBe("39710179128628335");
    expect(next.find((item) => item.id === "ves")?.business_id).toBe("16184247566784500");
    const fromUi = emptyEmpresa("sol");
    const onDisk = emptyEmpresa("sol");
    onDisk.business_id = "39710179128628335";
    expect(mergeEmpresaBusinessIds([onDisk], [fromUi])[0]?.business_id).toBe("39710179128628335");
  });

  it("não herda business_id se a razão ou o CNPJ do card mudaram", () => {
    const vesol = emptyEmpresa("a91abdad-ab5b-4f04-89f5-cfd2e30559fd");
    vesol.razao_social = "Vesol Energia Solar Ltda";
    vesol.cnpj = "51.449.498/0001-05";
    vesol.business_id = "1013153098495280";
    const pba = emptyEmpresa(vesol.id);
    pba.razao_social = "Pba Contabilidade Ltda";
    pba.cnpj = "09.180.372/0001-11";
    expect(mergeEmpresaBusinessIds([vesol], [pba])[0]?.business_id).toBeUndefined();

    const leaked = { ...pba, business_id: "1013153098495280" };
    expect(mergeEmpresaBusinessIds([vesol], [leaked])[0]?.business_id).toBeUndefined();

    const sameRazaoNewCnpj = { ...vesol, cnpj: "09.180.372/0001-11", business_id: undefined };
    expect(mergeEmpresaBusinessIds([vesol], [sameRazaoNewCnpj])[0]?.business_id).toBeUndefined();

    const sameCompany = emptyEmpresa(vesol.id);
    sameCompany.razao_social = "Vesol Energia Solar Ltda";
    sameCompany.cnpj = "51.449.498/0001-05";
    expect(mergeEmpresaBusinessIds([vesol], [sameCompany])[0]?.business_id).toBe("1013153098495280");
  });

  it("apaga business_id persistido quando o id vem vazio", () => {
    const card = emptyEmpresa("pba");
    card.business_id = "1013153098495280";
    expect(withEmpresaBusinessId([card], "pba", "").at(0)?.business_id).toBeUndefined();
  });
});
