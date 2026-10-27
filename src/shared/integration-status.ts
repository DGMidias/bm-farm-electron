import type { ConnectionResult, MenuId } from "./types";

export type IntegrationResults = {
  sms?: ConnectionResult;
  email?: ConnectionResult;
  adspower?: ConnectionResult;
};

export function navShowsIntegrationAlert(menuId: MenuId, results: IntegrationResults): boolean {
  if (menuId === "farm" || menuId === "history") return false;
  if (menuId === "sms") return results.sms?.ok === false;
  if (menuId === "email") return results.email?.ok === false;
  if (menuId === "adspower") return results.adspower?.ok === false;
  return false;
}
