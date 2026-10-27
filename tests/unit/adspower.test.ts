import { ADSPOWER_PROBE_URL, isAdsPowerRateLimit, listAdsPowerProfiles, profileParams, resetAdsPowerProfileCache } from "../../src/main/adspower";
import { formatAdsPowerOpen, formatAdsPowerProxy, formatAdsPowerStatus, mapAdsPowerActive, mapAdsPowerProfile } from "../../src/shared/adspower-view";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("AdsPower perfil", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAdsPowerProfileCache();
  });

  it("número vai como serial_number", () => {
    expect(profileParams("2")).toEqual({ serial_number: "2" });
    expect(profileParams("h1yynkm")).toEqual({ user_id: "h1yynkm" });
  });

  it("o teste de conexão abre o repo no GitHub só no perfil", () => {
    const url = new URL(ADSPOWER_PROBE_URL);
    expect(url.hostname).toBe("github.com");
    expect(url.pathname).toBe("/DGMidias/bm-farm-electron");
  });

  it("mapeia os campos relevantes do /user/list", () => {
    const profile = mapAdsPowerProfile({
      serial_number: "2",
      user_id: "h1yynkm",
      name: "Loja Centro",
      group_id: "10",
      group_name: "BMs",
      domain_name: "facebook.com",
      username: "loja@meta",
      remark: "proxy BR",
      created_time: "1612520997",
      ip: "13.251.172.174",
      ip_country: "sg",
      last_open_time: "1621333030",
    });
    expect(profile).toEqual({
      userId: "h1yynkm",
      serial: "2",
      name: "Loja Centro",
      groupName: "BMs",
      username: "loja@meta",
      domain: "facebook.com",
      remark: "proxy BR",
      ip: "13.251.172.174",
      ipCountry: "sg",
      createdAt: "2021-02-05T10:29:57.000Z",
      lastOpenAt: "2021-05-18T10:17:10.000Z",
    });
    expect(mapAdsPowerProfile({ name: "sem id" })).toBeUndefined();
    expect(formatAdsPowerProxy("13.251.172.174", "sg")).toBe("13.251.172.174 · SG");
    expect(formatAdsPowerProxy("", "")).toBe("—");
    expect(formatAdsPowerOpen()).toBe("nunca");
    expect(formatAdsPowerOpen("2021-05-18T10:17:10.000Z")).toMatch(/18\/05/);
    expect(formatAdsPowerStatus("aberto")).toBe("ABERTO");
    expect(mapAdsPowerActive("2", { status: "Inactive" })).toEqual({
      userId: "2",
      serial: "2",
      name: "Perfil 2",
      status: "fechado",
    });
  });

  it("quando /user/list é pago, descobre os perfis pelo serial", async () => {
    resetAdsPowerProfileCache();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/user/list")) {
        return jsonResponse({ code: -1, msg: "This feature is only available in paid subscriptions." });
      }
      if (url.includes("serial_number=1") || url.includes("serial_number=2")) {
        return jsonResponse({ code: 0, msg: "success", data: { status: "Inactive" } });
      }
      return jsonResponse({ code: -1, msg: "failed" });
    });
    const list = await listAdsPowerProfiles({ baseUrl: "http://127.0.0.1:50325", apiKey: "k", testProfile: "" });
    expect(list.map((item) => item.serial)).toEqual(["1", "2"]);
    expect(list[0]?.status).toBe("fechado");
  });

  it("não some com a lista quando a API pede calma", async () => {
    resetAdsPowerProfileCache();
    let hits = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      hits += 1;
      const url = String(input);
      if (url.includes("/api/v1/user/list") && hits === 1) {
        return jsonResponse({
          code: 0,
          msg: "success",
          data: { list: [{ user_id: "h1yynkm", serial_number: "2", name: "Loja" }] },
        });
      }
      return jsonResponse({ code: -1, msg: "Too many request per second, please check" });
    });
    const first = await listAdsPowerProfiles({ baseUrl: "http://127.0.0.1:50325", apiKey: "k", testProfile: "" });
    const second = await Promise.all([
      listAdsPowerProfiles({ baseUrl: "http://127.0.0.1:50325", apiKey: "k", testProfile: "" }),
      listAdsPowerProfiles({ baseUrl: "http://127.0.0.1:50325", apiKey: "k", testProfile: "" }),
    ]);
    expect(first[0]?.userId).toBe("h1yynkm");
    expect(second[0][0]?.userId).toBe("h1yynkm");
    expect(second[1][0]?.userId).toBe("h1yynkm");
    expect(hits).toBe(1);
    expect(isAdsPowerRateLimit("Too many request per second, please check")).toBe(true);
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}
