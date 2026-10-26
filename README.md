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
2. E-mail temporário — mail.tm, só validação
3. AdsPower — API local + chave
4. Farm de BM — cards no formato empresa.json + perfil
5. Histórico — logs locais sem segredo

O Facebook não abre nesta janela.
