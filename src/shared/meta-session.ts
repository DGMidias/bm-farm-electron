import { isPortfolioCreateForm } from "./portfolio-fill";

/** Senha/login.php de verdade. loginpage com modal de criar portfólio ou chooser não conta. */
export function metaNeedsLogin(input: { url: string; texts?: string[] }): boolean {
  const texts = input.texts ?? [];
  if (isPortfolioCreateForm(texts)) return false;
  const url = input.url.toLowerCase();
  if (!/facebook\.com|meta\.com/.test(url)) return false;
  const blob = texts.join(" ").toLowerCase();
  if (/\/login(?:\.php)?(?:[/?#]|$)/i.test(url) && /senha|password|e-mail ou telefone|email or phone/i.test(blob)) {
    return true;
  }
  return false;
}
