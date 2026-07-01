# Ramas y flujo de Pull Requests — salud-dashboard

Fuente de verdad del flujo de trabajo con Git en este repo. `CLAUDE.md` remite aquí;
si cambia una regla, se cambia en este documento (no se duplica el texto en otro sitio).

`main` es la rama protegida: siempre desplegable, siempre verde.

## Reglas duras

- **Nunca se commitea directo a `main`.** Todo cambio entra por Pull Request.
- **PR obligatorio siempre**, aunque trabajes solo. Deja historial y hace de checklist.
- **Squash and merge**: cada PR se colapsa en 1 commit limpio en main. Los commits
  WIP de la rama no ensucian el historial de main.
- **Una rama = una pieza.** Rama corta, un solo propósito, vida breve. Si crece, pártela.
- **CI verde + hook pre-push en local antes de pedir merge.** Nada se mergea en rojo.
- **Borrar la rama tras el merge** (local y remota; en remota lo hace GitHub solo).

## Nombrado de ramas

- `feat/<slug>` — funcionalidad nueva (ej. `feat/oauth-silent-refresh`)
- `fix/<slug>` — corrección de bug (ej. `fix/boot-race`)
- `infra/<slug>` — build, CI, tooling (ej. `infra/ci-guard`)
- `docs/<slug>` — solo documentación
- `chore/<slug>` — mantenimiento, limpieza, deps
- `archive/<slug>` — ramas viejas conservadas como referencia, no activas

El hook pre-push (`scripts/pre-push.sh`) rechaza push directo a `main` y valida que el
nombre de rama cumpla este patrón.

## Ciclo de vida de una pieza

1. `git switch main && git pull` — partir siempre de main actualizada.
2. `git switch -c feat/<slug>` — crear la rama.
3. Desarrollar en commits atómicos (imperativo, uno por mejora — ver CLAUDE.md).
4. **Probar en local**: `sh scripts/pre-push.sh` (o el hook al pushear) debe pasar
   — typecheck + build (dist limpio) + tests. Y verificar la app a mano en navegador
   (y en Cowork si el cambio toca la capa dual).
5. `git push -u origin feat/<slug>` — el hook pre-push corre automáticamente.
6. Abrir PR contra `main` (`gh pr create`). Descripción: qué, por qué, cómo se probó.
7. Esperar a que CI (deploy.yml, job `build`) pase en el PR.
8. **Squash and merge** vía GitHub. Título del squash = resumen imperativo de la pieza.
9. GitHub borra la rama remota. `git switch main && git pull` para la siguiente.

## Autorrevisión mínima en cada PR

- ¿Pasa CI y el hook local?
- ¿Respeta la capa dual (IS_COWORK) y el contrato de `rutina-salud.json`? (CLAUDE.md)
- ¿Toca innerHTML / datos externos / token? → razonar XSS e inyección explícitamente.
- ¿La app sigue: cargando el JSON, marcando progreso, guardando el log — en navegador
  Y en Cowork? (invariante "no degradar")

## Estado de las ramas

Historia: hubo features y fixes valiosos dispersos en varias ramas que nunca se
integraron porque rompían la app. `main` es la única versión que funciona; el valor de
las demás se rescata por piezas pequeñas sobre main (ver `docs/PLAN-INTEGRACION.md`),
no mergeando ramas enteras.

| rama | estado | qué es |
|---|---|---|
| `main` | **activa, protegida** | La única versión que funciona. Base de todo desarrollo. |
| `newFeatures` | en rescate | Features reales (silent refresh, logout, hidratar log) pero a medias. Se rescatan por piezas en Fases 2–4. |
| `archive/infra-wip` | archivada | Antes `sigueSinFuncionar`. Fixes de build/CI/hook que nunca funcionaron. Referencia para Fase 1 (se re-implementan adaptados a main). |

`lastWorkingVersion` se borró en Fase 0: solo tenía el tronco común (invalidación de
cache del SW), ningún commit propio, y el nombre inducía a error. Ese trabajo se rescata
en Fase 4.
