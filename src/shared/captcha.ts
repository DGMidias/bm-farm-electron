/**
 * Tentativa automática de CAPTCHA.
 * Hoje sempre falha — o espaço fica pronto para a implementação real.
 * Se retornar false, o farm pede ação humana.
 */
export async function attemptAutomaticCaptcha(_ctx?: unknown): Promise<boolean> {
  return false;
}

export function captchaNeedsHuman(automaticPassed: boolean): boolean {
  return automaticPassed !== true;
}
