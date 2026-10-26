import { profileParams } from "../../src/main/adspower";
import { describe, expect, it } from "vitest";

describe("AdsPower perfil", () => {
  it("número vai como serial_number", () => {
    expect(profileParams("2")).toEqual({ serial_number: "2" });
    expect(profileParams("h1yynkm")).toEqual({ user_id: "h1yynkm" });
  });
});
