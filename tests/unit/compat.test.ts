import { accelerator, artifactMatchesPlatform, joinPath, modKey, platformId, userDataPath } from "@harness/compat";
import { describe, expect, it } from "vitest";

describe("harness/compat", () => {
  it("identifica Win e Mac sem concatenar barra na mão", () => {
    expect(platformId("win32")).toBe("win");
    expect(platformId("darwin")).toBe("mac");
    expect(modKey("win32")).toBe("Control");
    expect(modKey("darwin")).toBe("Meta");
    expect(accelerator("C", "win32")).toBe("Ctrl+C");
    expect(accelerator("C", "darwin")).toBe("Cmd+C");
    expect(joinPath("a", "b")).not.toMatch(/a\/b\/|a\\\\b\\\\/);
    expect(userDataPath("electron-bm-farm", "win32")).toMatch(/electron-bm-farm/);
    expect(userDataPath("electron-bm-farm", "darwin")).toContain("Application Support");
  });

  it("escolhe artefato por SO", () => {
    expect(artifactMatchesPlatform("https://x/app.exe", "win32")).toBe(true);
    expect(artifactMatchesPlatform("https://x/app.zip", "darwin")).toBe(true);
    expect(artifactMatchesPlatform("https://x/app.exe", "darwin")).toBe(false);
  });
});
