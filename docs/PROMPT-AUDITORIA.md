# Prompt de auditoría — salud-dashboard

Pégalo en Claude Code desde la raíz del repo. Está escrito proposal-first:
Claude audita y propone, no toca código hasta que des el OK por bloque.

---

```markdown
# CONTEXTO DE SESIÓN

Rol activo: DEV (senior full-stack, foco en seguridad de código)
Proyecto: salud-dashboard (github.com/arnaldopxm/salud-dashboard)
Stack: HTML/CSS/JS vanilla, single-file (index.html), Google Drive API REST + Google Identity Services (OAuth token model), desplegado en GitHub Pages vía Actions
Restricciones conocidas: app de uso personal, sin backend; el código vive en Git, los datos (rutina-salud.json + logs) viven en Google Drive; debe seguir corriendo TANTO en navegador (OAuth) COMO en Cowork (window.cowork) — la capa dual no se rompe
Estado del trabajo: revisión/refactor de una primera versión funcional (v1.0)

## Qué quiero

Audita y propón mejoras de este repo. NO ejecutes cambios todavía: primero
entrégame un informe priorizado y espera mi OK explícito por bloque. Quiero
criterio activo, no que reflejes lo que ya hay — si ves un enfoque mejor, dilo.

## Alcance de la auditoría

1. **Seguridad (prioritario).** Es lo que más me importa.
   - Manejo del token OAuth (está en memoria; ¿hay fugas, XSS, riesgo en el
     manejo del access_token?).
   - Inyección: revisa todo el HTML que se construye con template strings y
     innerHTML. Hay un escapeHtml() — ¿se aplica en TODOS los sitios donde entra
     dato del JSON de Drive? Señala cada innerHTML sin escapar.
   - Scope de Drive: ahora pide `drive` completo. ¿Se puede acotar a
     `drive.file` o un scope más estrecho sin perder funcionalidad?
   - CSP: ¿tiene sentido añadir una Content-Security-Policy meta? Propón una.
   - Cualquier secreto o dato sensible que no debería estar en el repo.

2. **Estándares de código y mantenibilidad.**
   - El archivo es monolítico (~1600 líneas). Evalúa si merece la pena partirlo
     en módulos ES (manteniendo el deploy estático en Pages) o si el single-file
     es una decisión defendible aquí. Dame el trade-off, no la respuesta dogmática.
   - Consistencia: naming, manejo de errores, estado global (hay varias
     variables `let` a nivel módulo). ¿Patrón mejor sin sobre-ingeniería?
   - Accesibilidad básica (roles ARIA, foco, contraste) ya que es móvil-first.
   - Robustez del parser de markdown de sesiones (parseSessionMarkdown) y del
     parser de JSON de IA (tryParseAlternativas/tryParseSesion).

3. **Arquitectura.**
   - La capa dual (IS_COWORK) — ¿está bien aislada o se filtra por el código?
   - El log diario crea un archivo por día porque el connector solo permitía
     create. Ahora con la Drive API REST directa SÍ se puede update/patch.
     ¿Migramos a un único archivo de log actualizable, o mantenemos uno-por-día
     por trazabilidad? Dame pros y contras.
   - Manejo de expiración del token (ahora obliga a re-login en 401). ¿Refresh
     silencioso con GIS?

4. **Tooling.**
   - Propón linter/formatter (ESLint + Prettier) y un check mínimo en el
     workflow de Actions ANTES del deploy (lint + validación de que index.html
     parsea). Sin romper el deploy actual.
   - ¿Tests? Qué sería razonable testear en algo así sin montar un framework
     pesado.

## Cómo trabajar

- Proposal-first: informe priorizado (P1 seguridad, P2 corrección, P3 calidad,
  P4 nice-to-have). Para cada ítem: qué, por qué, y el diff propuesto a alto nivel.
- Espera mi "adelante" por bloque antes de tocar código.
- Cuando implementes, un commit atómico por mejora con mensaje claro.
- No degradar la app: tras cada cambio debe seguir cargando el JSON, marcando
  progreso y guardando el log, en navegador y en Cowork.
- Lee primero README.md y docs/COMO-FUNCIONA.md para el contexto completo.
```

---

## Notas de criterio (por qué este prompt y no otro)

- **Seguridad como P1** porque la app maneja un token OAuth y construye mucho HTML
  por concatenación de strings: ahí es donde primero hay que mirar.
- **Log uno-por-día vs. archivo único** se incluye explícitamente porque esa
  decisión venía forzada por una limitación del connector de Cowork (solo `create`)
  que **ya no aplica** con la Drive API REST directa (permite `PATCH`). Es la mejora
  de arquitectura más jugosa pendiente; conviene replantearla en vez de heredarla.
