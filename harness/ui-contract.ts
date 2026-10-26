export const FIELD_LIMITS = {
  short: 80,
  medium: 160,
  long: 400,
  notes: 2000,
  secret: 256,
  url: 400,
  cnpj: 18,
  cep: 9,
  uf: 2,
  phone: 20,
} as const;

export const UI_CONTRACT = {
  inputOverflow: "scroll-inside",
  sidebar: "fixed",
  tabCycle: true,
  nativeEditShortcuts: true,
  focusVisible: true,
  noLayoutBreakOnLongText: true,
} as const;

export function fieldMaxLength(kind: keyof typeof FIELD_LIMITS): number {
  return FIELD_LIMITS[kind];
}
