import { ADSPOWER_PROBE_URL, adspowerRequest, isAdsPowerRateLimit, listAdsPowerProfiles, profileParams, resetAdsPowerProfileCache } from "../../src/main/adspower";
import {
  formatAdsPowerOpen,
  formatAdsPowerProxy,
  formatAdsPowerStatus,
  mapAdsPowerActive,
  mapAdsPowerProfile,
  pickAdsPowerTabIndex,
  shouldReuseAdsPowerTab,
} from "../../src/shared/adspower-view";
import { afterEach, describe, expect, it, vi } from "vitest";

const adsConfig = { baseUrl: "http://127.0.0.1:50325", testProfile: "" };

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
    const list = await listAdsPowerProfiles(adsConfig);
    expect(list.map((item) => item.serial)).toEqual(["1", "2"]);
    expect(list[0]?.status).toBe("fechado");
  });

  it("não para no começo se 1-3 foram apagados e o primeiro serial é 4", async () => {
    resetAdsPowerProfileCache();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/user/list")) {
        return jsonResponse({ code: -1, msg: "This feature is only available in paid subscriptions." });
      }
      if (url.includes("serial_number=4") || url.includes("serial_number=5")) {
        return jsonResponse({ code: 0, msg: "success", data: { status: url.includes("serial_number=4") ? "Active" : "Inactive" } });
      }
      return jsonResponse({ code: -1, msg: "Profile does not exist" });
    });
    const list = await listAdsPowerProfiles(adsConfig);
    expect(list.map((item) => item.serial)).toEqual(["4", "5"]);
    expect(list[0]?.status).toBe("aberto");
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
    const first = await listAdsPowerProfiles(adsConfig);
    const second = await Promise.all([
      listAdsPowerProfiles(adsConfig),
      listAdsPowerProfiles(adsConfig),
    ]);
    expect(first[0]?.userId).toBe("h1yynkm");
    expect(second[0][0]?.userId).toBe("h1yynkm");
    expect(second[1][0]?.userId).toBe("h1yynkm");
    expect(hits).toBe(1);
    expect(isAdsPowerRateLimit("Too many request per second, please check")).toBe(true);
  });

  it("não manda Authorization e explica se a API local ainda pede key", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: -1, msg: "Please check the API-key" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(adspowerRequest(adsConfig, "/status")).rejects.toThrow(/desative a autenticação da API local/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toBeUndefined();
  });

  it("reusa a aba da Meta no mesmo perfil em vez de abrir outra", () => {
    expect(pickAdsPowerTabIndex(["https://github.com/DGMidias/bm-farm-electron", "https://business.facebook.com/latest/home"])).toBe(1);
    expect(pickAdsPowerTabIndex(["https://adsmanager.facebook.com/adsmanager/onboarding"])).toBe(0);
    expect(pickAdsPowerTabIndex(["https://github.com/DGMidias/bm-farm-electron"])).toBe(0);
    expect(pickAdsPowerTabIndex(["https://business.facebook.com/latest/home"], "https://github.com/DGMidias/bm-farm-electron")).toBe(-1);
    expect(pickAdsPowerTabIndex([])).toBe(-1);
    expect(shouldReuseAdsPowerTab({ running: true, profile: "5", target: "5" })).toBe(true);
    expect(shouldReuseAdsPowerTab({ running: false, profile: "5", target: "5" })).toBe(false);
    expect(shouldReuseAdsPowerTab({ running: true, profile: "4", target: "5" })).toBe(false);
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}
