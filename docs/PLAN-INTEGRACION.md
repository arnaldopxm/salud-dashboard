# Plan de integración de ramas — salud-dashboard

_Última actualización: 2026-07-01. Documento vivo: marca las casillas conforme avances._

Contexto: hay features y fixes valiosos dispersos en 3 ramas que nunca se integraron
porque rompían la app. `main` es la única versión que funciona. Este plan rescata ese
valor por piezas pequeñas y verificables sobre `main`, en vez de mergear ramas enteras.

## Estado de ramas (2026-07-01)

- **main** `51fc4ae` — la ÚNICA versión que funciona. Base de referencia.
- **sigueSinFuncionar** `15390fa` — fixes de build/CI/hook que NO llegaron a funcionar.
- **newFeatures** `de827c3` — features reales, pero en estado de depuración a medias.
- **lastWorkingVersion** `2c8f2c8` — nombre engañoso, NO es una versión que funcione.

Todas las ramas están POR DELANTE de main (main no tiene nada que ellas no tengan).
Ninguna se ha mergeado. main = base más vieja pero única verde.

## Tronco común (en las 3 ramas)

- `56fac75` Extraer lógica de build a build-utils.mjs + 15 tests
- `2c8f2c8` Invalidar cache del SW automáticamente en cada deploy

## Contenido por rama (commits sobre main)

### sigueSinFuncionar (infra build/CI)
| commit | qué | archivos |
|---|---|---|
| 6b3bc24 | hook pre-push que replica CI | scripts/pre-push.sh, package.json |
| f8b6b3b | orden build→test en CI | deploy.yml, pre-push.sh |
| 15390fa | build.js: rebuild antes de hashear bundle | build.js |
> Estos fixes asumen el build.js con inyección de hash en SW. main tiene otro build.js.
> Riesgo: pueden no aplicar limpio sobre main.

### newFeatures (features reales) — ⚠ estado de depuración
| commit | qué | archivos | estado |
|---|---|---|---|
| 3cf5021 | Hidratar localStorage con log del día al arrancar | core/log.ts, main.ts, tests | añade feature |
| a5a5595 | Silent refresh OAuth (no desloguear al recargar) | index.html, drive.ts, main.ts | feature clave |
| 47a44df | Logout via env-pill + revocar token | index.html, drive.ts, main.ts | feature |
| 27cccae + f9eacfc | Ignorar chrome-extension:// en SW (DUPLICADOS) | index.html | fix robustez |
| 20f6d11 / edd6515 | fixes build/CI (equivalen a los de sigueSinFuncionar) | build.js, tests | infra |
| de827c3 | Race condition del boot (inline vs bundle) | index.html | fix crítico |
| 8fd10a2 | **DESACTIVA** hidratar-log con FEATURE_PRELOAD_LOG=false | config.ts, main.ts | debug |

**Señal de alarma:** `8fd10a2` desactiva la feature que añadió `3cf5021`, "para aislar
si rompe la carga". La app se colgaba en "Cargando…". `de827c3` arregla una race
condition del boot. => newFeatures quedó a mitad de una investigación de por qué la
app no cargaba. NO es trabajo terminado y verde.
`FEATURE_PRELOAD_LOG = false` sigue en false en el HEAD de la rama.

### lastWorkingVersion
Solo el tronco común. Nada propio. Candidata a borrar (nombre confunde).

## Piezas de VALOR a rescatar (independientes de la rama que las contiene)

1. **Silent refresh OAuth** (a5a5595) — no re-loguear en cada recarga. Alta utilidad.
2. **Logout explícito** (47a44df) — falta en main. Depende de infra OAuth de #1.
3. **Fix SW chrome-extension://** (f9eacfc) — robustez, evita spinner colgado.
4. **Fix race condition boot** (de827c3) — crítico si se toca el arranque.
5. **Hidratar log del día** (3cf5021) — feature, PERO sospechosa de romper la carga.
6. **Infra build/CI + hook pre-push** (sigueSinFuncionar) — blindaje del pipeline.

## Hechos confirmados

- **main funciona:** carga, no cuelga, se ve la app, login OK. (confirmado por Arnaldo)
- **build.js de main NO inyecta hash.** Copia sw.js tal cual (línea 22). No tiene
  build-utils.mjs. CACHE_NAME es literal fijo 'salud-v1'.
  => IMPLICACIÓN: cache-first con nombre fijo = tras deploy sirve versión vieja hasta
     invalidar cache a mano. La invalidación por hash (tronco común de las ramas)
     resuelve esto. Encaja en la fase de SW (última), no antes.

## Flujo de trabajo — ramas y Pull Requests (norma del proyecto)

Aplica a TODO el desarrollo de la app, no solo a estas fases. `main` es la rama
protegida: siempre desplegable, siempre verde.

### Reglas duras

- **Nunca se commitea directo a `main`.** Todo cambio entra por Pull Request.
- **PR obligatorio siempre**, aunque trabajes solo. Deja historial y hace de checklist.
- **Squash and merge**: cada PR se colapsa en 1 commit limpio en main. Los commits
  WIP de la rama no ensucian el historial de main.
- **Una rama = una pieza.** Rama corta, un solo propósito, vida breve. Si crece,
  pártela.
- **CI verde + hook pre-push en local antes de pedir merge.** Nada se mergea en rojo.
- **Borrar la rama tras el merge** (local y remota).

### Nombrado de ramas

- `feat/<slug>` — funcionalidad nueva (ej. `feat/oauth-silent-refresh`)
- `fix/<slug>` — corrección de bug (ej. `fix/boot-race`)
- `infra/<slug>` — build, CI, tooling (ej. `infra/ci-guard`)
- `docs/<slug>` — solo documentación
- `chore/<slug>` — mantenimiento, limpieza, deps

### Ciclo de vida de una pieza

1. `git switch main && git pull` — partir siempre de main actualizada.
2. `git switch -c feat/<slug>` — crear la rama.
3. Desarrollar en commits atómicos (imperativo, uno por mejora — ver CLAUDE.md).
4. **Probar en local**: `sh scripts/pre-push.sh` (o el hook al pushear) debe pasar
   — typecheck + build (dist limpio) + tests. Y verificar la app a mano en navegador
   (y en Cowork si el cambio toca la capa dual).
5. `git push -u origin feat/<slug>` — el hook pre-push corre automáticamente.
6. Abrir PR contra `main` (`gh pr create`). Descripción: qué, por qué, cómo se probó.
7. Esperar a que CI (deploy.yml) pase en el PR.
8. **Squash and merge** vía GitHub. Título del squash = resumen imperativo de la pieza.
9. Borrar la rama. `git switch main && git pull` para la siguiente.

### Qué revisar en cada PR (autorrevisión mínima)

- ¿Pasa CI y el hook local?
- ¿Respeta la capa dual (IS_COWORK) y el contrato de rutina-salud.json? (CLAUDE.md)
- ¿Toca innerHTML / datos externos / token? → razonar XSS e inyección explícitamente.
- ¿La app sigue: cargando el JSON, marcando progreso, guardando el log — en navegador
  Y en Cowork? (invariante "no degradar")

### Protección de main en GitHub (configurar una vez — tarea de Fase 0)

- Require pull request before merging.
- Require status checks to pass (el job `build` de deploy.yml).
- (Opcional solo-tú) Permitir "Allow specified actors to bypass" vacío para forzarte
  a ti mismo a pasar por PR.

## Plan por pasos

Principio: rescatar por piezas pequeñas y verificables SOBRE main. NO mergear ramas
enteras (ya demostraron romper). Una rama corta por pieza, probada en local, luego PR.

Cada rama de las fases siguientes usa el flujo de arriba: partir de main → probar en
local → PR → CI verde → squash and merge → borrar rama.

Orden acordado: 0 → 1 → 2 (boot-race, silent-refresh, logout) →
3 (hidratar log) → 4 (SW, lo último, incluye la inyección de hash).

### Fase 0 — Higiene + automatizar el flujo (sin riesgo)

Objetivo: que las reglas del flujo (sección "Flujo de trabajo") dejen de depender de
recordarlas y las haga cumplir la infraestructura. La norma permanente debería vivir
también en CLAUDE.md (para que Claude Code la respete cada sesión); esta fase la
mueve/duplica allí y activa la automatización en GitHub + hooks.

Limpieza de ramas:

- [ ] Decidir destino de lastWorkingVersion (borrar o renombrar).
- [ ] Renombrar sigueSinFuncionar a algo descriptivo o marcarla como archivada.
- [ ] Documentar en el repo qué es cada rama (evitar futura confusión).

Automatización del flujo (lo que HACE CUMPLIR las reglas, no solo declararlas):

- [ ] Añadir sección "Flujo de ramas y PRs" a CLAUDE.md (norma que Claude lee siempre).
- [ ] Branch protection en main via GitHub — bloquea push directo, exige PR + CI verde:
      `gh api -X PUT repos/:owner/:repo/branches/main/protection ...`
      (require_pull_request_reviews, required_status_checks = job `build`,
       enforce_admins para forzarte a ti mismo a pasar por PR).
- [ ] Dejar solo squash como estrategia de merge del repo:
      `gh api -X PATCH repos/:owner/:repo -f allow_squash_merge=true \
       -f allow_merge_commit=false -f allow_rebase_merge=false \
       -f delete_branch_on_merge=true` (borra la rama automáticamente al mergear).
- [ ] Hook pre-push: validar que el nombre de rama cumple `feat|fix|infra|docs|chore/…`
      y rechazar push directo a main desde local (defensa en profundidad).
- [ ] (Opcional) Plantilla de PR en `.github/pull_request_template.md` con la
      checklist de autorrevisión (capa dual, contrato JSON, XSS, no degradar).

NOTA: lo automatizable es el CUMPLIMIENTO (GitHub + hooks). Que Claude siga la norma
no se automatiza — se logra teniéndola en CLAUDE.md.

### Fase 1 — Blindar el pipeline (antes de tocar features)
- [ ] Rama `infra/ci-guard` desde main.
- [ ] Rescatar hook pre-push + fix orden CI, ADAPTADO al build.js de main
      (main NO tiene build-utils.mjs ni inyección de hash — el hook debe reflejar
      el build.js real de main, no el de sigueSinFuncionar).
- [ ] Verificar en local con dist/ limpio que build+test pasan.
- [ ] PR + merge. A partir de aquí, nada se publica sin pipeline verde.
- NOTA: la inyección de hash en SW NO va aquí. Va en Fase 4 (SW).

### Fase 2 — Boot + OAuth (bajo/medio riesgo, alto valor)
Orden interno: boot-race primero (estabiliza el arranque), luego OAuth.
- [ ] Rama `fix/boot-race` — cherry-pick de827c3. Probar arranque navegador + Cowork.
- [ ] Rama `feat/oauth-silent-refresh` — a5a5595. Probar: recargar sin re-login.
- [ ] Rama `feat/logout` — 47a44df (encima de silent-refresh). Probar logout + revoke.
- [ ] Cada una: PR independiente, probada en local antes de push.

### Fase 3 — Hidratar log (riesgo alto — sospechosa)
- [ ] main NO cuelga hoy, así que el cuelgue que investigaba newFeatures NO está en
      main. Verificar si era esta feature o la race condition (Fase 2).
- [ ] Rama `feat/preload-log` — 3cf5021 + poner FEATURE_PRELOAD_LOG=true.
- [ ] Probar exhaustivo: carga navegador, carga Cowork, log visible al recargar.
- [ ] Si vuelve a colgar => la feature es la culpable; dejar flag en false y rediseñar.

### Fase 4 — Service Worker (lo último)
- [ ] Rama `fix/sw-chrome-extension` — f9eacfc (ignorar chrome-extension:// en SW).
- [ ] Invalidación de cache por hash: traer build-utils.mjs + injectSwVersion +
      CACHE_VERSION dinámico (tronco común 2c8f2c8 / 56fac75), ADAPTADO a main.
      Esto resuelve el "deploqueo y no veo cambios".
- [ ] Probar: SW instala sin error, cache se invalida al cambiar el bundle.

## Preguntas abiertas — RESUELTAS
- lastWorkingVersion se borra? → pendiente de decisión en Fase 0.
- build.js de main lleva hash? → NO. Confirmado. Inyección de hash va a Fase 4.
- app colgada en "Cargando…" pasa en main? → NO, main carga bien. Confirmado.
