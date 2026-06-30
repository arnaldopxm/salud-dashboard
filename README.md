# salud-dashboard

Dashboard personal de salud de Arnaldo, accesible desde el móvil. Lee el plan
desde Google Drive (`rutina-salud.json`, fuente única de verdad) y escribe el
progreso diario de vuelta a Drive (`_data/log/salud-log-YYYY-MM-DD.json`).

Es la evolución del live artifact de Cowork: el mismo dashboard, pero servido
como web app por GitHub Pages y autenticado con OAuth de Google en vez de
depender de `window.cowork`. Funciona en **ambos** entornos: en Cowork usa el
puente nativo; en el navegador usa la API REST de Drive.

## Estructura

```
salud-dashboard/
├── index.html                  ← la app entera (un solo archivo)
├── .github/workflows/deploy.yml ← CI: despliega a GitHub Pages en cada push
├── docs/
│   ├── COMO-FUNCIONA.md        ← arquitectura, OAuth, flujo de datos, sincronía
│   └── SETUP.md                ← puesta en marcha (OAuth + Pages + móvil)
├── .gitignore
└── LICENSE
```

## Puesta en marcha

Sigue [docs/SETUP.md](docs/SETUP.md). Resumen:

1. Crea un OAuth Client ID en Google Cloud (tipo *Web application*).
2. Pega ese Client ID en `index.html` (constante `GOOGLE_CLIENT_ID`).
3. Registra la URL de GitHub Pages como *Authorized JavaScript origin*.
4. Activa GitHub Pages (Settings → Pages → Source: GitHub Actions).
5. `git push` → el pipeline despliega → abre la URL en el móvil.

## Cómo funciona

Detalle completo en [docs/COMO-FUNCIONA.md](docs/COMO-FUNCIONA.md).

## Trabajar el repo con Claude Code

El repo trae su propio tooling de Claude Code en `.claude/` y prompts en `docs/`.
El principio es **proposal-first**: Claude audita o propone, y no toca código ni
hace commits/deploys sin un "adelante" explícito. "Quiero / necesito / estaría
bien" es intención, no permiso.

Al abrir el repo, Claude Code lee `CLAUDE.md` automáticamente (reglas, stack, las
dos invariantes que no se rompen: la capa dual `IS_COWORK` y el contrato de datos).
No hace falta repetirle el contexto.

### Slash commands (lo habitual)

| Comando | Para qué |
|---|---|
| `/audita` | Auditoría de seguridad completa (XSS, token, scope, secretos). Delega en `security-reviewer`. |
| `/nueva-feature <descripción>` | Añadir o cambiar una feature. Te dice qué tocaría y espera tu OK antes de editar. Delega en `feature-builder`. |
| `/pre-push` | Checklist determinista antes de pushear: HTML parsea, capa dual intacta, sin secretos, el plan no se escribe. |
| `/debug-drive <síntoma>` | Diagnostica login / 401-403 / log que no llega / JSON que no carga. Delega en `drive-oauth-debugger`. |

### Subagentes (en `.claude/agents/`)

Los invoca un comando, o Claude los elige solo según la tarea. También puedes
pedirlos a mano ("usa el security-reviewer para…"):

- **`security-reviewer`** — solo lectura. Encuentra y reporta riesgos; no arregla.
- **`feature-builder`** — implementa features respetando capa dual y contrato.
- **`drive-oauth-debugger`** — solo diagnóstico de auth/Drive; no edita.

### Flujo recomendado para un cambio

1. **Describe** lo que quieres (o lanza `/nueva-feature …`). Claude propone qué
   funciones tocaría y si afecta a la capa dual o al esquema de datos.
2. **Revisa la propuesta** y da el "adelante" (por bloques si es grande).
3. Claude implementa con **commits atómicos** (uno por mejora).
4. Lanza **`/pre-push`** para la verificación determinista.
5. **Tú** haces `git push`. El workflow despliega a Pages en 1-2 min.

> Para sesiones grandes hay prompts copia-pega en `docs/PROMPT-AUDITORIA.md`
> (auditoría) y `docs/PROMPT-REFACTOR.md` (refactor sin cambiar comportamiento).
> Haz la auditoría y cierra los P1/P2 antes de refactorizar.

### Reglas que Claude no rompe

- La **capa dual**: todo acceso a Drive pasa por `driveSearch/Download/Create` e
  `iaAskClaude`. La app debe seguir corriendo en navegador Y en Cowork.
- El **contrato de datos**: `rutina-salud.json` se lee, nunca se escribe; solo se
  escriben logs en `_data/log/`. Cambiar el esquema requiere tu aprobación.

## Relación con el vault

La documentación de conocimiento vive aquí, en el repo. El vault de Obsidian
solo guarda una nota-puntero que enlaza a este repositorio
(`github.com/arnaldopxm/salud-dashboard`) y a la URL de Pages — no duplica el
código ni la doc.

## Flujo de trabajo

El código vive en Git. Cualquier cambio se hace aquí, se commitea y se pushea;
el push dispara el workflow de Actions, que publica la versión nueva en Pages
en 1-2 minutos. No se edita el artifact de Cowork: queda deprecado.
