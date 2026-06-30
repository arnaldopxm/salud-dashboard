---
description: Añadir o cambiar una feature del dashboard, proposal-first
argument-hint: descripción de la feature
---

Quiero esta feature en el dashboard: $ARGUMENTS

Usa el subagente `feature-builder`. Antes de tocar código:

1. Lee CLAUDE.md y docs/COMO-FUNCIONA.md.
2. Dime EN QUÉ funciones de `index.html` tocarías y cómo, y si afecta a la capa
   dual (`driveSearch/Download/Create`, `iaAskClaude`) o al contrato de datos
   (`rutina-salud.json` se lee, no se escribe; esquema del log).
3. Si la feature exige cambiar el esquema del JSON o del log, PÁRATE y propónmelo
   aparte: hay otras piezas que dependen de él.
4. Espera mi "adelante" antes de editar.

Recuerda: single-file vanilla, sin build step, todo dato externo en el DOM pasa
por `escapeHtml`, y tras el cambio la app sigue funcionando en navegador Y Cowork.
Al final, dime qué probar a mano.
