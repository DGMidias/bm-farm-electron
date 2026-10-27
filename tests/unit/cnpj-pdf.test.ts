import { emptyEmpresa } from "@shared/empresa";
import { parseCnpjComprovante, parseCnpjFromOcr } from "@shared/cnpj-pdf";
import { describe, expect, it } from "vitest";

const VESOL_TEXT = `
REPÚBLICA FEDERATIVA DO BRASIL
CADASTRO NACIONAL DA PESSOA JURÍDICA
NÚMERO DE INSCRIÇÃO
51.449.498/0001-05
MATRIZ
COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO
CADASTRAL
DATA DE INSCRIÇÃO NO CNPJ
17/07/2023
NOME EMPRESARIAL
VESOL ENERGIA SOLAR LTDA
DATA DE CONSTITUIÇÃO
17/07/2023
TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)
VESOL ENERGIA SOLAR
PORTE
ME
CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL
43.21-5-00 - Instalação e manutenção elétrica
CÓDIGO E DESCRIÇÃO DAS ATIVIDADES ECONÔMICAS SECUNDÁRIAS
33.29-5-99 - Instalação de outros equipamentos não especificados anteriormente
47.42-3-00 - Comércio varejista de material elétrico
LOGRADOURO
R JOSE THEODORO RIBEIRO
NÚMERO
2723
COMPLEMENTO
********
CEP
89.258-001
BAIRRO/DISTRITO
ILHA DA FIGUEIRA
MUNICÍPIO
JARAGUA DO SUL
UF
SC
ENDEREÇO ELETRÔNICO
RAFAELA@VESOL.COM.BR
TELEFONE
(47) 3204-3799
`;

const FORALLZ_TEXT = `
NÚMERO DE INSCRIÇÃO
46.971.233/0001-32
MATRIZ
NOME EMPRESARIAL
FELIPI ESTEVAO MATOS DA TRINDADE 08777435680
DATA DE CONSTITUIÇÃO
30/06/2022
LOGRADOURO
AV LEITE DE CASTRO
NÚMERO
1679
COMPLEMENTO
APT 202
CEP
36.301-182
BAIRRO/DISTRITO
FABRICAS
MUNICÍPIO
SAO JOAO DEL REI
UF
MG
ENDEREÇO ELETRÔNICO
CADEFM@HOTMAIL.COM
TELEFONE
(37) 3321-4725
`;

describe("comprovante CNPJ", () => {
  it("preenche o card pelos campos oficiais da Receita", () => {
    const fields = parseCnpjComprovante(VESOL_TEXT);
    expect(fields.razao_social).toBe("Vesol Energia Solar Ltda");
    expect(fields.cnpj).toBe("51.449.498/0001-05");
    expect(fields.endereco).toBe("R Jose Theodoro Ribeiro, 2723");
    expect(fields.complemento).toBeUndefined();
    expect(fields.cidade).toBe("Jaragua do Sul");
    expect(fields.estado).toBe("SC");
    expect(fields.cep).toBe("89.258-001");
    expect(fields.telefone).toBe("(47) 3204-3799");
    expect(fields.email_comercial).toBe("rafaela@vesol.com.br");
    expect(fields.site).toBe("https://www.vesol.com.br");
  });

  it("empresa nova já vem com o toggle de ler PDF ligado", () => {
    expect(emptyEmpresa("1").ler_pdf_automatico).toBe(true);
  });

  it("lê o comprovante mesmo com OCR quebrando rótulo e pontuação", () => {
    const fields = parseCnpjComprovante(`
      NOWE EMPRESARIAL
      VESOL ENERGIA SOLAR LTDA
      TOGRADOURO NUMERO
      R JOSE THEODORO RIBEIRO 2723
      TE ENRRODISTRITO MONCIFIO
      ILHA DA FIGUEIRA JARAGUA DO SUL SC
      ENDERECO ELETRONICO TELEFONE
      RAFAELA@VESOL.COM.BR (47) 3204-3799
      51.449.498/0001-05
      CEP 89.258-001
    `);
    expect(fields.razao_social).toMatch(/Vesol Energia Solar Ltda/);
    expect(fields.cnpj).toBe("51.449.498/0001-05");
    expect(fields.endereco).toMatch(/Jose Theodoro Ribeiro/);
    expect(fields.cidade).toMatch(/Jaragua do Sul/);
    expect(fields.estado).toBe("SC");
    expect(fields.email_comercial).toBe("rafaela@vesol.com.br");
    expect(fields.telefone).toBe("(47) 3204-3799");
  });

  it("monta o card a partir das palavras do OCR com posição", () => {
    const fields = parseCnpjFromOcr([
      word("NOME", 20, 80),
      word("EMPRESARIAL", 70, 80),
      word("VESOL", 20, 98),
      word("ENERGIA", 80, 98),
      word("SOLAR", 150, 98),
      word("LTDA", 210, 98),
      word("LOGRADOURO", 20, 160),
      word("R", 20, 178),
      word("JOSE", 40, 178),
      word("THEODORO", 80, 178),
      word("RIBEIRO", 160, 178),
      word("NUMERO", 280, 160),
      word("2723", 280, 178),
      word("CEP", 20, 220),
      word("89.258-001", 20, 238),
      word("BAIRRO/DISTRITO", 140, 220),
      word("ILHA", 140, 238),
      word("DA", 175, 238),
      word("FIGUEIRA", 200, 238),
      word("MUNICIPIO", 320, 220),
      word("JARAGUA", 320, 238),
      word("DO", 390, 238),
      word("SUL", 415, 238),
      word("UF", 480, 220),
      word("SC", 480, 238),
      word("ENDEREÇO", 20, 280),
      word("ELETRÔNICO", 90, 280),
      word("RAFAELA@VESOL.COM.BR", 20, 298),
      word("TELEFONE", 320, 280),
      word("(47)", 320, 298),
      word("3204-3799", 360, 298),
      word("51.449.498/0001-05", 20, 40),
    ]);
    expect(fields.razao_social).toBe("Vesol Energia Solar Ltda");
    expect(fields.cnpj).toBe("51.449.498/0001-05");
    expect(fields.endereco).toBe("R Jose Theodoro Ribeiro, 2723");
    expect(fields.cidade).toBe("Jaragua do Sul");
    expect(fields.estado).toBe("SC");
    expect(fields.email_comercial).toBe("rafaela@vesol.com.br");
  });

  it("não inventa CNPJ a partir dos CNAEs", () => {
    const fields = parseCnpjComprovante(`
      CÓDIGO E DESCRIÇÃO DAS ATIVIDADES ECONÔMICAS SECUNDÁRIAS
      33.29-5-99 - Instalação de outros equipamentos
      47.42-3-00 - Comércio varejista de material elétrico
      62.02-3-00 - Desenvolvimento de programas
    `);
    expect(fields.cnpj).toBeUndefined();
    expect(fields.cnpj).not.toBe("00.332.959/9474-23");
  });

  it("lê o comprovante 2026 da Receita, inclusive complemento preenchido", () => {
    const fields = parseCnpjComprovante(FORALLZ_TEXT);
    expect(fields.razao_social).toBe("Felipi Estevao Matos da Trindade 08777435680");
    expect(fields.cnpj).toBe("46.971.233/0001-32");
    expect(fields.endereco).toBe("Av Leite de Castro, 1679");
    expect(fields.complemento).toBe("Apt 202");
    expect(fields.cidade).toBe("Sao Joao del Rei");
    expect(fields.estado).toBe("MG");
    expect(fields.cep).toBe("36.301-182");
    expect(fields.telefone).toBe("(37) 3321-4725");
    expect(fields.email_comercial).toBe("cadefm@hotmail.com");
  });
});

function word(text: string, x0: number, y0: number) {
  return { text, bbox: { x0, y0, x1: x0 + text.length * 7, y1: y0 + 12 } };
}
