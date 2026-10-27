import { redactSecrets } from "../../src/main/log";
import { describe, expect, it } from "vitest";

describe("logs", () => {
  it("esconde chave, bearer e jwt", () => {
    const raw =
      "Authorization: Bearer nv_live_abc123secret token=eyJhbGciOiJIUzUxMiJ9.aaaa.bbbb";
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain("abc123secret");
    expect(redacted).not.toContain("eyJhbGciOiJIUzUxMiJ9");
    expect(redacted).toContain("Bearer ***");
  });
});
