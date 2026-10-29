import { formatBrMobilePhone, formatEmpresaFields, titleName } from "@shared/empresa-format";
import { describe, expect, it } from "vitest";

describe("apresentação dos campos da empresa", () => {
  it("capitaliza nomes e deixa partículas minúsculas", () => {
    expect(titleName("VESOL ENERGIA SOLAR LTDA")).toBe("Vesol Energia Solar Ltda");
    expect(titleName("AV LEITE DE CASTRO, 1679")).toBe("Av Leite de Castro, 1679");
    expect(titleName("JARAGUA DO SUL")).toBe("Jaragua do Sul");
    expect(titleName("SAO JOAO DEL REI")).toBe("Sao Joao del Rei");
    expect(titleName("FELIPI ESTEVAO MATOS DA TRINDADE 08777435680")).toBe("Felipi Estevao Matos da Trindade 08777435680");
    expect(titleName("APT 202")).toBe("Apt 202");
  });

  it("aplica o padrão de cada campo do card", () => {
    const fields = formatEmpresaFields({
      razao_social: "VESOL ENERGIA SOLAR LTDA",
      cnpj: "51.449.498/0001-05",
      responsavel: "JESUS FERREYRA",
      email_comercial: "RAFAELA@VESOL.COM.BR",
      endereco: "R JOSE THEODORO RIBEIRO, 2723",
      complemento: "ILHA DA FIGUEIRA",
      cidade: "JARAGUA DO SUL",
      estado: "sc",
      cep: "89.258-001",
      telefone: "(47) 3204-3799",
      site: "https://www.vesol.com.br",
    });
    expect(fields.razao_social).toBe("Vesol Energia Solar Ltda");
    expect(fields.cnpj).toBe("51.449.498/0001-05");
    expect(fields.responsavel).toBe("Jesus Ferreyra");
    expect(fields.email_comercial).toBe("rafaela@vesol.com.br");
    expect(fields.endereco).toBe("R Jose Theodoro Ribeiro, 2723");
    expect(fields.complemento).toBe("Ilha da Figueira");
    expect(fields.cidade).toBe("Jaragua do Sul");
    expect(fields.estado).toBe("SC");
    expect(fields.cep).toBe("89.258-001");
    expect(fields.telefone).toBe("(47) 3204-3799");
    expect(fields.site).toBe("https://www.vesol.com.br");
    expect(formatBrMobilePhone("5535999887766")).toBe("(35) 99988-7766");
    expect(formatBrMobilePhone("35999887766")).toBe("(35) 99988-7766");
    expect(formatBrMobilePhone("(35) 99988-7766")).toBe("(35) 99988-7766");
  });
});
