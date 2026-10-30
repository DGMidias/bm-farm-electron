import type { ConnectionResult, MenuId } from "./types";

export type IntegrationResults = {
  sms?: ConnectionResult;
  email?: ConnectionResult;
  adspower?: ConnectionResult;
  openai?: ConnectionResult;
};

export function navShowsIntegrationAlert(menuId: MenuId, results: IntegrationResults): boolean {
  if (menuId === "farm" || menuId === "history") return false;
  if (menuId === "sms") return results.sms?.ok === false;
  if (menuId === "email") return results.email?.ok === false;
  if (menuId === "adspower") return results.adspower?.ok === false;
  if (menuId === "openai") return results.openai?.ok === false;
  return false;
}
