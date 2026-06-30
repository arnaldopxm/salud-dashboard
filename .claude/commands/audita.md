---
description: Auditoría de seguridad completa del repo (delega en security-reviewer)
---

Ejecuta una auditoría de seguridad completa de `index.html` y el repo. Usa el
subagente `security-reviewer`.

Cubre: XSS/inyección en cada `innerHTML` y template string con dato externo
(¿pasa por `escapeHtml`?), manejo del token OAuth, scope de Drive (¿se puede
acotar a `drive.file`?), CSP, secretos en el repo, orígenes externos cargados.

Entrega un informe priorizado (P1 crítico / P2 importante / P3 endurecimiento)
con archivo:línea y fix sugerido a alto nivel. NO apliques cambios: espera mi OK
por bloque.
