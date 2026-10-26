import { readFileSync } from "node:fs";
import { joinPath } from "@harness/compat";
import { detectScreen, snapshotFromTexts, type PageMap } from "@shared/map";
import { describe, expect, it } from "vitest";

const map = JSON.parse(readFileSync(joinPath(process.cwd(), "mapas", "meta-bm.v1.json"), "utf8")) as PageMap;

describe("mapa de páginas", () => {
  it("reconhece login, empresa e captcha", () => {
    expect(detectScreen(map, snapshotFromTexts("https://business.facebook.com/login", "Login", ["Entrar", "Senha"])).id).toBe("login");
    expect(
      detectScreen(map, snapshotFromTexts("https://business.facebook.com/latest/settings/business_info", "Info", ["Razão social da empresa"])).id,
    ).toBe("empresa.info");
    expect(detectScreen(map, snapshotFromTexts("https://business.facebook.com/", "X", ["Não sou um robô"])).human).toBe("captcha");
  });
});
