import { extractValidationCode, inboxStatusLabel, mapMailMessage, mergeSeenMessages, rememberInbox } from "../../src/main/mail-tm";
import { inboxOwnerLabel } from "@shared/mail-view";
import { smsReady } from "../../src/main/sms";
import { describe, expect, it } from "vitest";

describe("adapters", () => {
  it("guarda caixas e mescla só o que o GET enxergar", () => {
    const first = {
      id: "a1",
      address: "bm1@mail.tm",
      token: "t1",
      password: "p1",
      createdAt: "2026-10-26T23:00:00.000Z",
      active: true,
      messages: [],
    };
    const second = { ...first, id: "a2", address: "bm2@mail.tm" };
    expect(rememberInbox([], { ...first, address: "" })).toEqual([]);
    const list = rememberInbox(rememberInbox([], first), second);
    expect(list.map((item) => item.address)).toEqual(["bm2@mail.tm", "bm1@mail.tm"]);
    const live = [mapMailMessage({ id: "m2", from: { address: "meta@fb.com" }, subject: "Novo", intro: "oi", createdAt: "2026-10-26T23:10:00.000Z" })];
    const cached = [mapMailMessage({ id: "m1", from: { address: "old@x.com" }, subject: "Velho", intro: "já vi" })];
    const merged = mergeSeenMessages(live, cached);
    expect(merged.map((item) => item.id).sort()).toEqual(["m1", "m2"]);
    expect(inboxStatusLabel(true)).toBe("ATIVO");
    expect(inboxStatusLabel(false)).toBe("SEM ACESSO");
    const owned = rememberInbox([], {
      ...first,
      razaoSocial: "Vesol Energia Solar Ltda",
      adspowerProfile: "2",
      empresaId: "e1",
    });
    expect(owned[0]?.razaoSocial).toBe("Vesol Energia Solar Ltda");
    expect(inboxOwnerLabel(owned[0]!)).toBe("Vesol Energia Solar Ltda · perfil 2");
  });

  it("extrai código da validação", () => {
    expect(extractValidationCode("Seu código é 482913 e expira em 10 minutos.")).toBe("482913");
  });

  it("SMS só fica pronto com URL e chave", () => {
    expect(smsReady({ baseUrl: "", apiKey: "x", countryCode: "BR", serviceCode: "fb", serviceId: "60033", apiId: "", ddd: "35", lastActivationId: "", lastPhone: "", knownActivations: [], activationChanges: [] })).toBe(false);
    expect(
      smsReady({
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
      }),
    ).toBe(true);
  });
});
