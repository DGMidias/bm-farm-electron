import { compareSemver, isRemoteNewer } from "@shared/semver";
import { describe, expect, it } from "vitest";

describe("semver", () => {
  it("compara versões", () => {
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
    expect(isRemoteNewer("0.1.0", "0.2.0")).toBe(true);
    expect(isRemoteNewer("1.0.0", "0.9.9")).toBe(false);
  });
});
