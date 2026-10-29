import { attemptAutomaticCaptcha, captchaNeedsHuman } from "@shared/captcha";
import { describe, expect, it } from "vitest";

describe("CAPTCHA automático", () => {
  it("a tentativa automática ainda não resolve e cai em ação humana", async () => {
    const passed = await attemptAutomaticCaptcha();
    expect(passed).toBe(false);
    expect(captchaNeedsHuman(passed)).toBe(true);
    expect(captchaNeedsHuman(true)).toBe(false);
  });
});
