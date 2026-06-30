# CLAUDE.md — salud-dashboard

Contexto que se carga al abrir el repo. Léelo antes de tocar nada.

## Qué es

Dashboard personal de salud de Arnaldo, accesible desde el móvil. Una sola página
(`index.html`) que lee el plan desde Google Drive y escribe el progreso diario de
vuelta a Drive. Es la evolución de un live artifact de Cowork a web app servida por
GitHub Pages. Detalle completo en `README.md` y `docs/COMO-FUNCIONA.md` — léelos.

## Stack

- HTML/CSS/JS vanilla, **single-file** (`index.html`). Sin framework, sin build step.
- Google Identity Services (OAuth token model) para auth en navegador.
- Google Drive API REST para leer el plan y escribir el log.
- GitHub Pages + Actions (`.github/workflows/deploy.yml`) para el deploy.

## Las dos invariantes que NO se rompen

> [!warning] Capa dual (IS_COWORK)
> El mismo `index.html` corre en navegador (OAuth + Drive REST) y en Cowork
> (`window.cowork`). Todo acceso a Drive pasa por las 4 funciones neutrales:
> `driveSearch`, `driveDownload`, `driveCreate`, `iaAskClaude`. NUNCA llames a
> `window.cowork` ni a `fetch` de Drive fuera de esas funciones. Si añades una
> operación de Drive, añádela a la capa, no la disperses por el código.

> [!warning] Contrato de datos
> La fuente de verdad del plan es `rutina-salud.json` en Drive. La app lo LEE,
> nunca lo escribe. Lo único que escribe es el log diario en `_data/log/`
> (`salud-log-YYYY-MM-DD.json`). No cambies el esquema del JSON ni del log sin que
> Arnaldo lo apruebe: hay otras piezas (artifact, scheduled, vault) que dependen
> de él.

## Separación de capas

- **Git (este repo)** = código + su documentación. Cambia con cada push.
- **Google Drive** = datos (plan + logs). Nunca metas datos en el repo ni código
  en Drive.
- **Vault de Obsidian** = solo un puntero a este repo. No vive aquí.

## Cómo trabajar (innegociable)

1. **Proposal-first.** No generes código, ni hagas commits, ni deploys sin un "sí",
   "adelante" o "hazlo" explícito. "Quiero", "necesito", "estaría bien" son
   intención, no permiso. Describe lo que harías y espera.
2. **Criterio activo.** Si ves un enfoque mejor, una duplicación, deuda técnica o
   un riesgo de seguridad, dilo aunque no te lo pidan. No reflejes pasivamente.
3. **No microdecisiones en silencio.** Si hay más de una opción razonable (stack,
   formato, alcance), declara la que tomarías y por qué, y espera confirmación.
4. **Seguridad primero.** Esta app maneja un token OAuth y construye mucho HTML por
   concatenación. Ante cualquier cambio que toque `innerHTML`, datos externos o el
   token, razona la seguridad explícitamente (OWASP: XSS, inyección).
5. **Commits atómicos.** Uno por mejora, mensaje claro en imperativo.
6. **No degradar.** Tras cualquier cambio, la app debe seguir: cargando el JSON,
   marcando progreso y guardando el log — en navegador Y en Cowork.

## Mapa rápido del código (index.html)

- **Config + capa dual** (inicio del `<script>`): `GOOGLE_CLIENT_ID`, `IS_COWORK`,
  `driveSearch/Download/Create`, `iaAskClaude`, OAuth (GIS).
- **Estado + utilidades**: `today`, `weeksSince`, `escapeHtml`, `slugify`, fichas.
- **Carga**: `loadData` (login → search → download → render).
- **Render por pestaña**: `renderHorario` (Hoy), `loadRehabSession`/`renderRehab*`
  (Rehab), `renderKegel`/timer (Kegel), `renderFuerza` (Fuerza), `renderPies`
  (Pies), `renderPlan` (Plan).
- **Motor de selección**: `seleccionarEjercicios`, `microcicloIdx`, tiers.
- **Cambiar ejercicio**: `alternativasDelPool` (local, funciona en móvil),
  `pedirAlternativasIA`/`generarSesionHoy` (IA, SOLO Cowork).
- **Log**: `construirLogDelDia`, `guardarDiaEnDrive`, registro por ejercicio.

## Limitación conocida

La IA (`iaAskClaude`) solo existe en Cowork. En navegador lanza error explicativo.
Las alternativas del pool sí funcionan en móvil (lógica local).

## Recursos del repo para Claude Code

- Subagentes: `.claude/agents/` (security-reviewer, feature-builder, drive-oauth-debugger).
- Comandos: `.claude/commands/` (`/audita`, `/nueva-feature`, `/pre-push`, `/debug-drive`).
- Prompts copia-pega: `docs/PROMPT-AUDITORIA.md`, `docs/PROMPT-REFACTOR.md`.
