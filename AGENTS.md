# Contrato para agentes

Windows e macOS são inegociáveis. Feature que só passa num dos dois não entra.

- Use `harness/compat.ts` para path, atalho (Ctrl vs Cmd) e artefato de update. Não concatene `\` ou `/` na mão.
- Não carregue `facebook.com` na `BrowserWindow` do Electron. O browser da Meta é o Chromium do AdsPower via CDP.
- Um perfil AdsPower por card de empresa. Sem lote cego.
- Não commite `.env`, `userData/`, API keys ou OTP.
- Toda feature nova: teste no harness (`npm run test:harness`) + linha em `CHANGELOG.md` com o motivo.
- SMS só é usado se URL e API key estiverem configuradas.
- E-mail temporário (mail.tm) só na etapa de validação da BM.
- CAPTCHA, OTP e envio final: pausa humana. Sem bypass.
