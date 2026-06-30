---
description: Verificación determinista antes de hacer push
---

Verifica que el repo está listo para push. Es una checklist, no una auditoría
de criterio. Reporta PASA/FALLA por punto:

1. **HTML parsea.** `index.html` tiene balanceados `<html></html>`, `<head></head>`,
   `<body></body>` y los `<script></script>` (son 2: GIS + app).
2. **Capa dual intacta.** `grep -n "window.cowork" index.html` — TODAS las
   apariciones deben estar dentro de la capa dual (funciones `driveSearch`,
   `driveDownload`, `driveCreate`, `iaAskClaude`) o en comentarios. Ninguna suelta
   por el render.
3. **No fetch de Drive fuera de la capa.** `grep -n "googleapis.com" index.html`
   solo en `driveSearch/Download/Create`/`driveFetch`.
4. **El plan no se escribe.** Ningún `driveCreate` apunta a `rutina-salud.json`:
   solo se crean `salud-log-*.json`.
5. **Sin secretos.** Ningún token, client secret ni credencial en el repo. El
   `GOOGLE_CLIENT_ID` (público) es la única credencial admisible.
6. **Escape.** Búsqueda rápida de `innerHTML` con interpolación de dato externo
   sin `escapeHtml` cercano — si hay candidatos sospechosos, lístalos (no bloquea,
   avisa).
7. **Workflow.** `.github/workflows/deploy.yml` existe y apunta a Pages.

Si todo PASA, dímelo y sugiere un mensaje de commit. NO hagas el push tú: lo hago
yo.
