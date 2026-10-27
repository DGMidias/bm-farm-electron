# Contrato para agentes

Windows e macOS são inegociáveis. Feature que só passa num dos dois não entra.

- Use `harness/compat.ts` para path, atalho (Ctrl vs Cmd) e artefato de update. Não concatene `\` ou `/` na mão.
- Não carregue `facebook.com` na `BrowserWindow` do Electron. O browser da Meta é o Chromium do AdsPower via CDP.
- Um perfil AdsPower por card de empresa. Sem lote cego.
- Não commite `.env`, `userData/`, API keys ou OTP.
- Toda feature nova: teste no harness (`npm run test:harness`) + linha em `CHANGELOG.md` com o motivo.
- SMS só é usado se URL e API key estiverem configuradas.
- E-mail temporário (mail.tm) na criação do portfólio (etapa 1) e na validação da BM. Etapa 1 sempre gera caixa nova — nunca o e-mail do PDF/CNPJ. A verificação da Meta cai nessa caixa, listada com empresa e perfil AdsPower.
- CAPTCHA, OTP, envio final e perfil sem login na Meta: pausa humana. Sem bypass. Logout de verdade é `login.php` + senha. `business/loginpage` com o modal de criar portfólio já aberto não é logout — preenche os campos. Sem clicar **Continuar com o Facebook** por cima do diálogo.
- Locators da Meta são genéricos: papel ou texto do chrome (combobox do seletor, "Portfólios empresariais", "Criar um portfólio empresarial"). Nunca clique nem busque pelo nome da página, da BM ou da empresa. Comparar razão social só para saber se ela já está na lista.
- Depois de criar, dois destinos: assistente (Avançar/Confirmar) ou `latest/home?business_id=` com "Não é possível acessar o Meta Business Suite". O segundo não é tela desconhecida — extrai o `business_id` e vai para `/latest/settings/business_users/?nav_ref=bm_settings_redirect_migration&bm_redirect_migration=true&business_id=`. Aí abre o seletor. A partir daí a navegação das settings usa esse id.
