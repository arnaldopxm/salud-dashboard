## Qué

<!-- La pieza en una frase. Una rama = una pieza. -->

## Por qué

<!-- Motivo / problema que resuelve. -->

## Cómo se probó

<!-- pre-push local (typecheck + build dist limpio + tests) y prueba manual. -->

- [ ] `sh scripts/pre-push.sh` pasa en local (typecheck + build + tests)
- [ ] Probado a mano en navegador
- [ ] Probado en Cowork (si toca la capa dual)

## Autorrevisión (ver docs/RAMAS.md y CLAUDE.md)

- [ ] Respeta la capa dual (IS_COWORK): todo Drive pasa por `driveSearch/Download/Create`, `iaAskClaude`
- [ ] Respeta el contrato de `rutina-salud.json` (la app lo LEE; solo escribe el log diario)
- [ ] Si toca `innerHTML` / datos externos / token OAuth → seguridad razonada (XSS, inyección)
- [ ] No degrada: la app sigue cargando el JSON, marcando progreso y guardando el log (navegador Y Cowork)
