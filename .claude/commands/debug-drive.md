---
description: Diagnosticar un fallo de login / Drive / OAuth
argument-hint: síntoma (ej. "401 al guardar el log")
---

Algo de auth o de acceso a Drive no funciona. Síntoma: $ARGUMENTS

Usa el subagente `drive-oauth-debugger`. Diagnostica antes de proponer fix:

1. ¿Falla en navegador (rama OAuth) o en Cowork (rama window.cowork)? `IS_COWORK`
   decide; son caminos distintos.
2. Mapea el síntoma a la causa probable (revisa `loadData`, `iniciarLogin`,
   `initTokenClient`, `driveFetch`, y la función de Drive implicada).
3. Distingue "lo arreglas tú en Google Cloud / GitHub Pages" de "es un bug del
   código". Cita archivo:línea.
4. Dime cómo confirmarlo (qué mirar en consola/red) y el fix sugerido. No edites
   código: el fix lo aplicamos después.
