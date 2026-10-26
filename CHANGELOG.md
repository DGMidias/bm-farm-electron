# Changelog

Formato: data · o que mudou · por que · o que não desfazer.

## 2026-10-26 — Base Electron 0.1.0

- **O quê:** scaffold Electron + Vite + React, cinco menus (SMS, e-mail, AdsPower, Farm, Histórico), persistência em userData, harness Win+Mac, auto-update por `latest.json`, mapa `mapas/meta-bm.v1.json`, motor CDP supervisionado e pausa humana.
- **Por quê:** a fatia 0 do plano precisa de UI estável, HMR e gate de compatibilidade antes de crescer o farm.
- **Não desfazer:** `harness/compat.ts` como única fonte de path/atalho; Facebook fora da janela Electron; CI `windows-latest` + `macos-latest` como gate.
