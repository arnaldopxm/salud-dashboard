# Modo local — probar la app (y la PWA) sin login ni Drive

Para iterar layout/estilos en el móvil sin pasar por el login de Google ni tocar
Drive. Carga un **fixture** en vez de los datos reales. Es andamiaje de
desarrollo: el fixture y el mini servidor están gitignored y **no** se despliegan.

## Cómo se activa

El bundle entra en modo local (`isLocalMode()` en `src/main.ts`) si:

- la URL lleva `?local`, **o**
- la app se sirve bajo una ruta que termina en `/local/`.

En modo local, `loadData()` salta el login/Drive y hace `fetch` de
`dev/rutina-salud.sample.json` (un fixture con el esquema de `rutina-salud.json`).

## En el navegador de escritorio

1. `npm run serve`
2. Abre `http://localhost:8080/?local`

## En el iPhone como PWA instalada

El manifest de producción apunta a `/salud-dashboard/` (subpath de GitHub Pages),
que no existe al servir en local → la PWA instalada daría 404. Y iOS descarta el
query `?local` al arrancar desde el `start_url`. Por eso el modo local se activa
**por ruta** (`/local/`) y se sirve con un manifest cuyo `start_url`/`scope` son
`/local/`, enlazado de forma estática en el HTML (el swap por JS llega tarde para
iOS). De eso se encarga el mini servidor `dev-server.mjs`:

1. `node dev-server.mjs` (puerto 8080 por defecto)
2. En Safari (misma red WiFi): `http://<IP-LAN>:8080/local/`
   - Saca tu IP LAN con `ipconfig` (la del adaptador WiFi/Ethernet, no la de
     interfaces virtuales tipo WSL/Hyper-V).
3. Compartir → **Añadir a inicio**. Comprueba que la URL mostrada es `/local/`.
4. Abre el icono: arranca en standalone, con datos, sin login.

Si reinstalas, **borra antes el icono viejo** (iOS cachea el manifest por icono).

## Archivos (todos gitignored salvo el branch de código)

| Archivo | Qué es | ¿En el repo? |
|---|---|---|
| `dev/rutina-salud.sample.json` | Fixture con datos de ejemplo | No (gitignored) |
| `dev-server.mjs` | Mini servidor que sirve `/local/` con el manifest correcto | No (gitignored) |
| `isLocalMode()` + branch en `src/main.ts` | Detección del modo y carga del fixture | Sí |

El fixture no lleva datos reales; recréalo a mano si hace falta siguiendo el
esquema de `src/types/schema.ts`.
