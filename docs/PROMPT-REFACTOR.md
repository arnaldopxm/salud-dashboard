# Prompt de refactor — salud-dashboard

Copia-pega en Claude Code cuando quieras refactorizar sin añadir features.
Complementa a `PROMPT-AUDITORIA.md` (ese busca problemas; este reorganiza).

---

```markdown
# CONTEXTO DE SESIÓN

Rol activo: DEV (senior full-stack)
Proyecto: salud-dashboard
Estado: refactor de index.html (single-file vanilla, ~1600 líneas), sin cambiar comportamiento

## Qué quiero

Refactorizar para mantenibilidad SIN cambiar comportamiento observable y SIN
romper las dos invariantes (lee CLAUDE.md): la capa dual (IS_COWORK) y el contrato
de datos (rutina-salud.json se lee, log se escribe en _data/log/).

Proposal-first: propón el plan de refactor por bloques y espera mi OK por bloque.

## Líneas de trabajo (proponme, no ejecutes)

1. **Organización del archivo.** Secciones claras con separadores, orden lógico
   (config/capa dual → utils → carga → render por pestaña → motor → log). Evalúa
   si partir en módulos ES merece la pena dado que el deploy es estático en Pages
   (sin bundler). Dame el trade-off real, no dogma.

2. **Estado global.** Hay varias `let` a nivel módulo (DATA, timerState,
   openChangePanel, etc.). ¿Encapsular en un objeto de estado? Sin sobre-ingeniería.

3. **Consistencia.** Naming uniforme, manejo de errores homogéneo (hoy hay
   try/catch dispares), helpers duplicados si los hay.

4. **Render.** Los `render*` mezclan construcción de HTML (template strings) con
   lógica. Evalúa extraer los builders de HTML a funciones puras testeables.

5. **Sin regresiones.** Para cada bloque, dime cómo verifico que no cambié
   comportamiento: qué pestaña/flujo probar en navegador y en Cowork.

## Reglas

- Un commit atómico por bloque de refactor, mensaje en imperativo.
- No tocar el esquema del JSON ni del log.
- No introducir dependencias ni build step sin aprobarlo como decisión aparte.
- Todo dato externo en el DOM sigue pasando por escapeHtml.
```

---

## Nota de criterio

Refactor y auditoría son sesiones distintas a propósito: mezclar "arreglar bugs de
seguridad" con "reorganizar el archivo" en el mismo PR hace el diff ilegible y
esconde regresiones. Haz primero la auditoría (`PROMPT-AUDITORIA.md`), cierra los
P1/P2, y solo entonces refactoriza sobre una base limpia.
