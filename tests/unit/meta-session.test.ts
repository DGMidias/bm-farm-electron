import { formatNotLoggedInLog } from "@shared/farm-log";
import { metaNeedsLogin } from "@shared/meta-session";
import { PORTFOLIO_URL } from "@shared/farm-etapas";
import { describe, expect, it } from "vitest";

const LOGINPAGE =
  "https://business.facebook.com/business/loginpage/?next=https%3A%2F%2Fbusiness.facebook.com%2F%3Fnav_ref%3Dbm_home_redirect_default_login&login_options%5B0%5D=FB&config_ref=biz_login_tool_flavor_mbs";

describe("sessão Meta", () => {
  it("só pede login com senha; loginpage com modal de criar não é logout", () => {
    expect(metaNeedsLogin({ url: LOGINPAGE })).toBe(false);
    expect(
      metaNeedsLogin({
        url: LOGINPAGE,
        texts: ["Comece a usar as", "Continuar com o Facebook", "Criar nova conta"],
      }),
    ).toBe(false);
    expect(
      metaNeedsLogin({
        url: LOGINPAGE,
        texts: ["Crie seu portfólio empresarial no Gerenciador de Negócios", "Nome da sua conta e empresa", "Enviar"],
      }),
    ).toBe(false);
    expect(
      metaNeedsLogin({
        url: "https://www.facebook.com/login.php",
        texts: ["E-mail ou telefone", "Senha", "Entrar"],
      }),
    ).toBe(true);
    expect(metaNeedsLogin({ url: PORTFOLIO_URL })).toBe(false);
    expect(
      metaNeedsLogin({
        url: "https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=1",
      }),
    ).toBe(false);
    expect(formatNotLoggedInLog("3")).toBe(
      "Perfil 3 não está logado na Meta · faça login no AdsPower e clique em Continuar.",
    );
  });
});
