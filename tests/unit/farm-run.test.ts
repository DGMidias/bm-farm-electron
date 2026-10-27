import { canDismissCompany, canDismissFarm, farmNeedsReview } from "@shared/farm-run";
import type { FarmCompanyRun } from "@shared/types";
import { describe, expect, it } from "vitest";

function company(partial: Partial<FarmCompanyRun> & Pick<FarmCompanyRun, "id" | "status">): FarmCompanyRun {
  return {
    razaoSocial: partial.razaoSocial ?? partial.id,
    attention: false,
    logs: [],
    ...partial,
  };
}

describe("revisão do farm após a etapa", () => {
  it("mantém a sessão aberta depois do ok até o usuário concluir a aba", () => {
    const done = [company({ id: "e1", status: "ok", razaoSocial: "Vesol Energia Solar Ltda" })];
    expect(farmNeedsReview({ companies: done })).toBe(true);
    expect(canDismissCompany(done[0]!)).toBe(true);
    expect(canDismissFarm({ companies: done })).toBe(true);
    expect(farmNeedsReview({ companies: [{ ...done[0]!, dismissed: true }] })).toBe(false);
  });

  it("só mostra concluir geral quando todas as abas abertas já terminaram", () => {
    const mixed = [
      company({ id: "e1", status: "ok" }),
      company({ id: "e2", status: "running" }),
    ];
    expect(canDismissCompany(mixed[0]!)).toBe(true);
    expect(canDismissCompany(mixed[1]!)).toBe(false);
    expect(canDismissFarm({ companies: mixed })).toBe(false);
    expect(farmNeedsReview({ companies: mixed })).toBe(true);
  });
});
