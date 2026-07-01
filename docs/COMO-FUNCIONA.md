# Cómo funciona — salud-dashboard

## Visión general

Una sola página HTML (`index.html`) que renderiza el dashboard de salud con seis
pestañas (Hoy, Rehab, Kegel, Fuerza, Pies, Plan). No tiene backend propio: habla
directamente con Google Drive, donde vive el plan y el log.

```
Móvil / navegador
   │  abre
   ▼
GitHub Pages  (https://arnaldopxm.github.io/salud-dashboard)
   │  login Google (OAuth, una vez)
   ▼
Google Drive API REST
   │  lee                              │  escribe
   ▼                                   ▼
rutina-salud.json                 _data/log/salud-log-YYYY-MM-DD.json
(fuente única de verdad)          (progreso del día)
```

## Dos fuentes de verdad, separadas por naturaleza

- **Git (este repo)** = el código y su documentación. Cambia con cada push.
- **Google Drive** = los datos: el plan (`rutina-salud.json`) y los logs diarios.

No se mezclan. El dashboard nunca guarda el plan; solo lo lee. Lo único que
escribe es el log del día, en su propia carpeta.

## La capa dual de acceso a Drive

El dashboard se diseñó originalmente como artifact de Cowork, donde el acceso a
Drive pasaba por `window.cowork.callMcpTool(...)`. Esa función solo existe dentro
de Cowork, así que en el móvil no servía.

La solución es una capa de abstracción al principio del `<script>`. El resto del
código llama siempre a cuatro funciones neutrales, que internamente eligen el
camino según el entorno:

| Función          | En Cowork (`window.cowork`)        | En navegador (OAuth + REST)                          |
|------------------|------------------------------------|------------------------------------------------------|
| `driveSearch`    | `callMcpTool('…search_files')`     | `GET /drive/v3/files?q=…`                             |
| `driveDownload`  | `callMcpTool('…download_…')`       | `GET /drive/v3/files/{id}?alt=media` → base64        |
| `driveCreate`    | `callMcpTool('…create_file')`      | `POST /upload/drive/v3/files` (multipart)            |
| `iaAskClaude`    | `window.cowork.askClaude(...)`     | no disponible — lanza error claro (ver más abajo)    |

La detección es `const IS_COWORK = window.cowork && typeof window.cowork.callMcpTool === 'function'`.
Un mismo `index.html` corre en los dos sitios sin ramas divergentes.

## Dos motores de arranque: inline vs bundle

Ojo, esto es sutil y ha causado bugs. El `index.html` contiene **dos**
implementaciones del arranque (y de OAuth y de `loadData`), y cuál manda depende
del entorno:

- **Script inline** (dentro de `<script>` en `index.html`): es el que corre en
  **Cowork**, donde no hay bundle. Tiene su propio `gisToken`, su `loadData` y su
  `boot()`.
- **Bundle TypeScript** (`src/` compilado a `dist/bundle.js`, cargado con `defer`):
  es el que corre en **navegador**. Tiene *su propio* `gisToken` (en
  `src/core/drive.ts`), su `loadData` (`src/main.ts`) y su `boot()`. Al arrancar,
  el bundle sobreescribe `window.iniciarLogin`, `window.loadData`, etc., así que
  los `onclick` del HTML acaban invocando las funciones del bundle.

En navegador se cargan los dos, pero solo el bundle debe arrancar la app. Por eso
el `boot()` inline solo llama a `loadData()` **`if (IS_COWORK)`**: si no, ambos
compiten y la app se cuelga en "Cargando…" (race condition del boot).

> [!warning] El token vive en un sitio por motor — no los cruces
> Cada motor guarda el access token en SU propio `gisToken`. En el bundle, la
> **fuente de verdad** es `getGisToken()` de `src/core/drive.ts`. No compruebes la
> sesión contra ninguna otra variable ni global: hubo un bug en que el bundle
> comprobaba `window.__saludGisToken` (que nadie asignaba nunca), así que tras un
> login correcto la app rebotaba al login. Si necesitas saber si hay sesión en el
> bundle, usa `getGisToken()`.

## Autenticación (solo navegador)

Se usa **Google Identity Services** (token model, OAuth implícito en cliente).
Al abrir la app sin sesión, se muestra una pantalla de login. Al pulsar *Entrar
con Google*, GIS pide un access token con scope `drive`. El token se guarda solo
**en memoria** (variable `gisToken` — una por motor de arranque, ver arriba),
nunca en `localStorage` ni en disco. Si caduca (HTTP 401), la app pide volver a
entrar.

El **Client ID** (constante `GOOGLE_CLIENT_ID` en `index.html`) no es un secreto:
los OAuth Client ID de tipo Web son públicos por diseño. La seguridad la da la
lista de *Authorized JavaScript origins* en Google Cloud — solo los dominios que
registres pueden usar ese Client ID. Por eso hay que registrar la URL de Pages.
Para probar en local necesitas también registrar el origen `http://localhost:8080`
(el puerto que usan `npm run serve` / `npm run preview`).

### Silent refresh: no re-loguear en cada recarga

El token vive solo en memoria, así que al recargar la página se pierde. Para no
obligar a re-loguear cada vez, al **primer login** se guarda en `localStorage` un
flag `salud-gis-authorized` (**solo el flag, nunca el token**). Al arrancar, si el
flag existe, la app intenta una renovación silenciosa: `requestAccessToken({ prompt: '' })`.
Google devuelve un token nuevo sin popup **si aún tiene sesión activa** y el scope
ya estaba concedido. Si no la tiene, dispara el `error_callback` de GIS y la app
cae a la pantalla de login (falla cerrado). No es un bypass de consentimiento: es
el flujo estándar de renovación de GIS.

### Logout

El **env-pill** de abajo a la derecha ("Web"/"Cowork") es además el botón de
cerrar sesión (hover rojo, `confirm()` antes de actuar). Al confirmar,
`cerrarSesion()` / `revokeAuthorization()`:

1. Anula `gisToken` y `gisTokenClient` en memoria.
2. Borra el flag `salud-gis-authorized` de `localStorage` (impide el silent refresh).
3. **Revoca el token en Google** con `google.accounts.oauth2.revoke()` — no basta
   con olvidarlo localmente; se invalida en origen.
4. Recarga la página → la guarda de sesión da "sin sesión" → login.

Igual que el resto de OAuth, existe en las dos capas: inline (`index.html`, Cowork)
y bundle (`src/main.ts` + `src/core/drive.ts`, navegador).

## Flujo de datos

### Lectura (cada apertura)
1. `driveSearch("title = 'rutina-salud.json'")` → coge el más reciente.
2. `driveDownload(fileId)` → base64 → `TextDecoder('utf-8')` → `JSON.parse`.
3. `render()` pinta las seis pestañas.

La pestaña Rehab además busca la sesión más reciente en `02-rutinas` por nombre
(`YYYYMMDD-HHmm_sesion_…`) y la parsea desde markdown.

### Escritura (marcar hecho / registro)
- Los checks de cada tarea, las molestias y la nota del día se acumulan en
  `localStorage` durante el día.
- Al pulsar **Guardar día en Drive** (o al cerrar la pestaña, vía `visibilitychange`
  / `pagehide`), se construye un objeto y se escribe con `driveCreate` en
  `_data/log/` como `salud-log-YYYY-MM-DD.json`.
- Se usa **un archivo por día**, no update, porque el connector original de Drive
  solo permitía crear, no actualizar. La web app respeta el mismo esquema para que
  artifact y web produzcan logs idénticos.

> El `localStorage` es por navegador. Si marcas en el móvil y guardas, el log
> llega a Drive y queda disponible para todos. Pero los checks aún-no-guardados
> de un navegador no aparecen en otro hasta que pulses Guardar.

## La IA no está en el navegador

Los botones *Sugerencia con IA* (al cambiar ejercicio) y *Generar sesión de hoy*
usaban `window.cowork.askClaude`, que no existe fuera de Cowork. En el navegador,
`iaAskClaude` lanza un error explicativo que la UI muestra: la función queda
visible pero indica que solo opera en Cowork.

Las **alternativas del pool** (cambiar ejercicio por otro del mismo patrón) **sí
funcionan en el móvil**: son lógica local sobre el JSON, no llaman a IA.

Llevar la IA al navegador requeriría un backend que guarde la API key (un proxy);
no se ha hecho para no introducir infraestructura ni exponer credenciales en el
cliente.

## Persistencia y privacidad

- El token de Google vive solo en memoria de la pestaña.
- El progreso del día vive en `localStorage` hasta que se guarda en Drive.
- No hay analítica, ni cookies de terceros, ni servidor intermedio: la app habla
  con Drive y con nadie más.

## Compatibilidad con el artifact de Cowork

El mismo archivo sigue corriendo en Cowork (detecta `window.cowork`). El artifact
antiguo de Cowork queda deprecado: la fuente de verdad del código es ahora este
repo. Si alguna vez se quiere volver a empotrar en Cowork, basta con cargar este
`index.html`.
