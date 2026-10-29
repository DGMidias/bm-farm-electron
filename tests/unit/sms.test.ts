import { BR_DDDS, DEFAULT_DDD, isBrDdd } from "../../src/shared/ddd";
import {
  activationOwnerLabel,
  buildCreateBody,
  canCancelActivation,
  defaultSmsOption,
  dddFromPhone,
  diffActivationChanges,
  extractActivationList,
  formatActivationWhen,
  formatExpiry,
  formatRestClock,
  formatSmsOptionLabel,
  isHtmlBody,
  latestSms,
  mapActivation,
  mapSmsServices,
  mergeSeenActivations,
  nationalPhone,
  normalizeDdd,
  normalizeSmsBase,
  normalizeSmsCountry,
  optionAllowsDdd,
  rememberActivation,
  resolveSmsSelection,
  sanitizeSmsKey,
  smsAuthHeaders,
  smsFlavor,
  smsReady,
  sortSmsServices,
} from "../../src/main/sms";
import { extractConfirmationLink } from "../../src/main/mail-22do";
import { describe, expect, it } from "vitest";

describe("SMS numero-virtual", () => {
  it("normaliza painel .com e .com.br para a API Bearer", () => {
    expect(normalizeSmsBase("https://app.numero-virtual.com.br/developers")).toBe(
      "https://app.numero-virtual.com/api/v1",
    );
    expect(normalizeSmsBase("https://app.numero-virtual.com/api/v1/")).toBe(
      "https://app.numero-virtual.com/api/v1",
    );
    expect(normalizeSmsBase("https://api.numero-virtual.app/api/v1")).toBe(
      "https://api.numero-virtual.app/api/v1",
    );
  });

  it("só fica pronto com URL e chave", () => {
    expect(smsReady({ ...readySms(), baseUrl: "" })).toBe(false);
    expect(smsReady(readySms())).toBe(true);
  });

  it("corta chave colada duas vezes e manda Bearer", () => {
    const dirty =
      "nv_live_fc65e8c5c3de0b8e42350e61d107dafbfbb586dd202aa2ddnv_live- fc65e8c5c3de0b8e42350e61d107dafbfbb586dd202aa2dd";
    expect(sanitizeSmsKey(dirty)).toBe("nv_live_fc65e8c5c3de0b8e42350e61d107dafbfbb586dd202aa2dd");
    const headers = smsAuthHeaders(dirty);
    expect(headers.Authorization).toBe("Bearer nv_live_fc65e8c5c3de0b8e42350e61d107dafbfbb586dd202aa2dd");
    expect(headers["x-api-key"]).toBe("nv_live_fc65e8c5c3de0b8e42350e61d107dafbfbb586dd202aa2dd");
  });

  it("usa país ISO-2 no host .com e ISO-3 no .app", () => {
    expect(smsFlavor("https://app.numero-virtual.com/api/v1")).toBe("com");
    expect(smsFlavor("https://api.numero-virtual.app/api/v1")).toBe("app");
    expect(normalizeSmsCountry("BRA", "com")).toBe("BR");
    expect(normalizeSmsCountry("BR", "app")).toBe("BRA");
  });

  it("recusa HTML do site como se fosse JSON da API", () => {
    expect(isHtmlBody("<!doctype html><html lang=\"pt-BR\">")).toBe(true);
    expect(isHtmlBody('{"success":true}')).toBe(false);
  });

  it("tem todos os DDDs do Brasil e o padrão é 35", () => {
    expect(DEFAULT_DDD).toBe("35");
    expect(isBrDdd("35")).toBe(true);
    expect(isBrDdd("49")).toBe(true);
    expect(isBrDdd("00")).toBe(false);
    expect(BR_DDDS.length).toBeGreaterThanOrEqual(67);
    expect(normalizeDdd("35")).toBe("35");
    expect(normalizeDdd("049")).toBe("49");
    expect(dddFromPhone("5549999887766")).toBe("49");
    expect(buildCreateBody({ ...readySms(), ddd: "35", serviceId: "60033" })).toEqual({
      serviceId: 60033,
      country: "BR",
      ddd: "35",
    });
  });

  it("agrupa serviços e marca DDD só nas opções que aceitam", () => {
    const services = mapSmsServices({
      services: [
        {
          serviceId: 1,
          serviceCode: "wa",
          serviceName: "Whatsapp",
          priceFormatted: "R$ 2.00",
          options: [{ apiId: 9, name: "Opção 3", price: 2, priceFormatted: "R$ 2.00", available: 4 }],
        },
        {
          serviceId: 60033,
          serviceCode: "fb",
          serviceName: "Facebook",
          priceFormatted: "R$ 1.30",
          options: [
            { apiId: 1, name: "Opção 1", price: 1.3, priceFormatted: "R$ 1.30", available: 10, supportsDdd: true },
            { apiId: 3, name: "Opção 3", price: 1.43, priceFormatted: "R$ 1.43", available: 8 },
            { apiId: 4, name: "Opção 4", price: 1.3, priceFormatted: "R$ 1.30", available: 5, supportsDdd: true },
            { apiId: 7, name: "Opção 7", price: 1.1, priceFormatted: "R$ 1.10", available: 2 },
          ],
        },
      ],
    });
    expect(services[0]?.id).toBe("60033");
    expect(services[0]?.options.map((item) => item.apiId)).toEqual(["1", "3", "4", "7"]);
    expect(services[0]?.options.find((item) => item.apiId === "1")?.allowsDdd).toBe(true);
    expect(services[0]?.options.find((item) => item.apiId === "3")?.allowsDdd).toBe(false);
    expect(optionAllowsDdd({ name: "Opção 1" })).toBe(true);
    expect(optionAllowsDdd({ name: "Opção 3" })).toBe(false);
    expect(defaultSmsOption(services[0]?.options ?? [])?.apiId).toBe("1");
    expect(formatSmsOptionLabel(services[0]!.options[0]!)).toMatch(/Opção 1 · R\$ 1\.30.*DDD/);
    expect(formatSmsOptionLabel(services[0]!.options[1]!)).toBe("Opção 3 · R$ 1.43");
    const selected = resolveSmsSelection(services, { ...readySms(), apiId: "3" });
    expect(selected.group?.name).toBe("Facebook");
    expect(selected.option?.apiId).toBe("3");
    expect(selected.allowsDdd).toBe(false);
    expect(buildCreateBody({ ...readySms(), apiId: "3", ddd: "35" }, selected.option)).toEqual({
      serviceId: 60033,
      country: "BR",
      apiId: 3,
    });
    expect(
      buildCreateBody({ ...readySms(), apiId: "1", ddd: "35" }, services[0]?.options.find((item) => item.apiId === "1")),
    ).toEqual({
      serviceId: 60033,
      country: "BR",
      apiId: 1,
      ddd: "35",
    });
  });

  it("formata prazo e só deixa cancelar número ainda válido", () => {
    expect(formatExpiry("2026-01-01T10:10:00.000Z", Date.parse("2026-01-01T10:00:00.000Z"))).toBe("10min 0s");
    expect(formatExpiry("2026-01-01T09:00:00.000Z", Date.parse("2026-01-01T10:00:00.000Z"))).toBe("expirado");
    const pending = mapActivation({ id: 1, phone: "5535", status: "pending", expiresAt: "2026-01-01T10:10:00.000Z" });
    expect(canCancelActivation(pending, Date.parse("2026-01-01T10:00:00.000Z"))).toBe(true);
    expect(canCancelActivation({ ...pending, status: "cancelled" }, Date.parse("2026-01-01T10:00:00.000Z"))).toBe(false);
  });

  it("coloca Facebook no topo do select de serviços", () => {
    const sorted = sortSmsServices([
      { id: "1", code: "ot", name: "Outros apps/Site", options: [] },
      { id: "60033", code: "fb", name: "Facebook", options: [] },
      { id: "2", code: "aa", name: "Aaa", options: [] },
    ]);
    expect(sorted[0]?.id).toBe("60033");
  });

  it("guarda e escolhe um número já conhecido", () => {
    const first = mapActivation({ id: 1, phone: "5535999887766", status: "pending" });
    const second = mapActivation({ id: 2, phone: "5549999887766", status: "received", smsCode: "111" });
    const list = rememberActivation(rememberActivation([], first), second);
    expect(list).toHaveLength(2);
    expect(rememberActivation(list, { ...first, status: "received" })[0]?.status).toBe("received");
  });

  it("abre o envelope da API e lista todas as ativações visíveis", () => {
    const nested = mapActivation({
      status: "waiting_sms",
      activation: {
        id: 88,
        phoneNumber: "5549920063023",
        serviceName: "Facebook",
        apiId: 1,
        createdAt: "2026-10-26T23:12:00.000Z",
        expiresAt: "2026-10-26T23:32:00.000Z",
      },
    });
    expect(nested.id).toBe("88");
    expect(nested.phone).toBe("5549920063023");
    expect(nested.serviceName).toBe("Facebook");
    expect(nested.optionLabel).toBe("1");
    expect(nested.status).toBe("waiting_sms");
    expect(rememberActivation([], mapActivation({ status: "waiting_sms" }))).toEqual([]);
    expect(extractActivationList({ activations: [{ id: 1, phone: "5511" }, { id: 2, number: "5549" }] })).toHaveLength(2);
    const live = [mapActivation({ id: 1, phone: "5511", status: "waiting_sms" })];
    const cached = [mapActivation({ id: 1, phone: "5511", status: "pending" }), mapActivation({ id: 2, phone: "5549", status: "cancelled" })];
    const merged = mergeSeenActivations(live, cached);
    expect(merged.map((item) => item.id).sort()).toEqual(["1", "2"]);
    expect(merged.find((item) => item.id === "1")?.status).toBe("waiting_sms");
    const changes = diffActivationChanges(cached, merged, "2026-10-26T23:13:00.000Z");
    expect(changes.some((item) => item.field === "status" && item.from === "pending" && item.to === "waiting_sms")).toBe(true);
    expect(formatRestClock("2026-01-01T10:18:19.000Z", Date.parse("2026-01-01T10:00:00.000Z"))).toBe("18:19");
    expect(formatActivationWhen("2026-10-26T23:12:00.000Z")).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(nationalPhone("5549920063023")).toBe("49920063023");
    const owned = mergeSeenActivations(
      [mapActivation({ id: 1, phone: "5511", status: "waiting_sms" })],
      [{ ...mapActivation({ id: 1, phone: "5511", status: "pending" }), razaoSocial: "Vesol Energia Solar Ltda", adspowerProfile: "4" }],
    );
    expect(owned.find((item) => item.id === "1")?.razaoSocial).toBe("Vesol Energia Solar Ltda");
    expect(owned.find((item) => item.id === "1")?.adspowerProfile).toBe("4");
    expect(activationOwnerLabel({ razaoSocial: "Vesol Energia Solar Ltda", adspowerProfile: "4" })).toBe(
      "Vesol Energia Solar Ltda · perfil 4",
    );
    expect(activationOwnerLabel({})).toBe("sem empresa");
  });

  it("lê smsCode da API .com e o SMS mais recente da .app", () => {
    const com = mapActivation({ id: 9, phone: "5511", status: "received", smsCode: "654321", smsText: "Facebook: 654321" });
    expect(com.messages[0]?.code).toBe("654321");
    const last = latestSms([
      { id: "1", text: "antigo", code: "111111", receivedAt: "2026-01-01T10:00:00.000Z" },
      { id: "2", text: "novo", code: "222222", receivedAt: "2026-01-01T10:05:00.000Z" },
    ]);
    expect(last?.code).toBe("222222");
  });
});

describe("e-mail de confirmação", () => {
  it("extrai link de confirmação", () => {
    expect(extractConfirmationLink("Confirme em https://business.facebook.com/confirm?x=1 agora")).toBe(
      "https://business.facebook.com/confirm?x=1",
    );
  });
});

function readySms() {
  return {
    baseUrl: "https://app.numero-virtual.com/api/v1",
    apiKey: "x",
    countryCode: "BR",
    serviceCode: "fb",
    serviceId: "60033",
    apiId: "",
    ddd: "35",
    lastActivationId: "",
    lastPhone: "",
    knownActivations: [],
    activationChanges: [],
  };
}
