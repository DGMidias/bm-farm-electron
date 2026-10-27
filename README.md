# electron-bm-farm

App Electron (Windows e macOS inegociáveis) para configurar provedores e conduzir cadastro supervisionado de BM no Chromium do AdsPower.

## Desenvolvimento

```bash
npm install
npm run dev
```

O renderer tem HMR. O processo main só reinicia se o código nativo mudar.

```bash
npm test
npm run test:harness
```

## Menus

1. SMS — API numero-virtual
2. Email (mail.tm) — temporário, só validação
3. AdsPower — logo no menu; badge testa a API local a cada 5s; com a conexão ok, lista os perfis do AdsPower
4. Farm de BM — ícone no menu; PDF do comprovante CNPJ preenche o card
5. Histórico — ícone no menu; logs locais sem segredo

Atualização: ao abrir, o app compara `package.json` com `latest.json` em GitHub Releases (`win` = `.exe`, `mac` = `.zip`). Veja `latest.example.json`.

O Facebook não abre nesta janela.
