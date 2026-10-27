# Capturas do farm

O worker grava uma variante em `portfolio.landing`, `portfolio.form`, `portfolio.existing`, `portfolio.unavailable`, `portfolio.settings_users` e `unknown`. Em erro, timeout ou **Reportar tela**, grava mesmo se o fingerprint já existir.

```
mapas/captures/<screenId>/<timestamp>/
  meta.json
  screen.png   (opcional)
  dom.html     (HTML da página — o que colamos no chat para desenhar o scraping)
```

`meta.json`:

```json
{
  "url": "https://adsmanager.facebook.com/adsmanager/onboarding",
  "title": "Gerenciador de Anúncios",
  "fingerprint": "a1b2c3d4",
  "screenId": "portfolio.landing",
  "reason": "auto",
  "capturedAt": "2026-10-27T15:16:06.660Z",
  "labels": [{ "role": "link", "name": "Criar portfólio empresarial" }],
  "anyText": ["Começar", "Criar portfólio empresarial"]
}
```

`reason`: `auto` (dedup por fingerprint), `error` ou `operator` (sempre grava). PNG, HTML e JSON desta pasta não entram no git.
