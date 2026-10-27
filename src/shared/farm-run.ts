import type { FarmCompanyRun, FarmCompanyStatus, FarmRunState } from "./types";

export function companyWorkerDone(status: FarmCompanyStatus): boolean {
  return status === "ok" || status === "erro";
}

export function farmNeedsReview(state: Pick<FarmRunState, "companies">): boolean {
  return state.companies.some((item) => !item.dismissed);
}

export function canDismissCompany(company: FarmCompanyRun): boolean {
  return !company.dismissed && companyWorkerDone(company.status);
}

export function canDismissFarm(state: Pick<FarmRunState, "companies">): boolean {
  const open = state.companies.filter((item) => !item.dismissed);
  return open.length > 0 && open.every((item) => companyWorkerDone(item.status));
}

export function visibleFarmCompanies(state: Pick<FarmRunState, "companies">): FarmCompanyRun[] {
  return state.companies.filter((item) => !item.dismissed);
}
