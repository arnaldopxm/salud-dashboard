# Setup — salud-dashboard

Pasos para dejar la app funcionando en el móvil. Tiempo estimado: 15-20 min.
Hazlos en orden. Los marcados con 🧑 son tuyos (no los puede hacer el LLM).

---

## 0. Requisitos

- El repo ya existe: `github.com/arnaldopxm/salud-dashboard`.
- Tienes acceso a la cuenta de Google donde vive el vault (`rutina-salud.json`).

---

## 1. 🧑 Crear el OAuth Client ID en Google Cloud

Esto es lo que permite a la web pedirte login y hablar con tu Drive.

1. Entra en <https://console.cloud.google.com/>.
2. Arriba, crea (o elige) un proyecto. Nómbralo p. ej. `salud-dashboard`.
3. Menú → **APIs y servicios** → **Biblioteca** → busca **Google Drive API** →
   **Habilitar**.
4. Menú → **APIs y servicios** → **Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo** → Crear.
   - Rellena nombre de la app (`Salud Dashboard`), tu email de soporte y el de
     contacto. El resto puede ir en blanco.
   - En **Usuarios de prueba**, añade tu propia cuenta de Google (la del vault).
     Mientras la app esté en modo *Testing*, solo los usuarios de prueba pueden
     entrar — que eres tú, así que perfecto.
   - Guarda. No necesitas publicar la app ni pasar verificación para uso personal.
5. Menú → **APIs y servicios** → **Credenciales** → **Crear credenciales** →
   **ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: `salud-dashboard-web`.
   - **Orígenes de JavaScript autorizados** → Añadir URI. Pon EXACTAMENTE:
     ```
     https://arnaldopxm.github.io
     ```
     (sin barra final, sin la parte `/salud-dashboard`). Si vas a probar en local,
     añade también `http://localhost:8000` o el puerto que uses.
   - **NO** hace falta rellenar "URIs de redirección autorizados" (el token model
     de GIS no los usa).
   - Crear. Copia el **ID de cliente** (algo como
     `123456789-abc...apps.googleusercontent.com`).

---

## 2. Pegar el Client ID en `index.html`

Abre `index.html` y busca esta línea (cerca del inicio del `<script>`):

```js
const GOOGLE_CLIENT_ID = '';  // <-- pega aquí tu Client ID de Google Cloud
```

Pega tu ID entre las comillas:

```js
const GOOGLE_CLIENT_ID = '123456789-abc...apps.googleusercontent.com';
```

Guarda. (Recuerda: este ID no es secreto, puede ir en el repo público.)

---

## 3. 🧑 Activar GitHub Pages

1. En GitHub, repo `salud-dashboard` → **Settings** → **Pages**.
2. En **Build and deployment** → **Source**, elige **GitHub Actions**.
   (No "Deploy from a branch" — usamos el workflow `.github/workflows/deploy.yml`.)
3. No hace falta nada más aquí; el primer push lo despliega.

---

## 4. 🧑 Primer push

Desde la carpeta del repo en tu máquina:

```bash
git add .
git commit -m "Web app: dashboard salud con OAuth + Drive API + Pages"
git push origin main
```

El push dispara el workflow. Míralo en la pestaña **Actions** del repo. Cuando el
job **Deploy to GitHub Pages** termine en verde (1-2 min), tu sitio está vivo en:

```
https://arnaldopxm.github.io/salud-dashboard/
```

---

## 5. Abrir en el móvil

1. Abre esa URL en el navegador del móvil.
2. Pulsa **Entrar con Google** → elige tu cuenta del vault → acepta los permisos
   de Drive.
3. La app carga `rutina-salud.json` y muestra el dashboard.
4. (Opcional) "Añadir a pantalla de inicio" para tenerlo como una app.

---

## Verificación rápida

- [ ] La app carga el plan y muestra las 6 pestañas.
- [ ] Marcas una tarea en **Hoy** → pulsas **Guardar día en Drive** → aparece
      `salud-log-<hoy>.json` en `_data/log/` de tu Drive.
- [ ] El timer de **Kegel** cuenta.
- [ ] En **Fuerza**, "Cambiar ejercicio" → un motivo → muestra alternativas del pool.

---

## Problemas comunes

**"Falta GOOGLE_CLIENT_ID"** → no pegaste el ID en el paso 2, o no se ha
desplegado el commit que lo incluye.

**Ventana de Google dice "Acceso bloqueado" / "no verificada"** → tu cuenta no
está en *Usuarios de prueba* (paso 1.4), o la pantalla de consentimiento no está
configurada. Para uso personal en modo Testing es suficiente añadirte como tester.

**"redirect_uri_mismatch" o "origin not allowed"** → el origen de JavaScript del
paso 1.5 no coincide. Debe ser `https://arnaldopxm.github.io` exacto, sin ruta ni
barra final.

**El log no aparece en Drive** → revisa que iniciaste sesión con la cuenta correcta
y que el scope `drive` se concedió. Mira la consola del navegador por si hay un 403.

**Cambié el código y no se ve** → ¿hiciste push? ¿el workflow de Actions terminó en
verde? El navegador puede cachear: recarga forzando (o abre en incógnito).

---

## Cómo iterar a partir de ahora

El flujo es: editas `index.html` → `git commit` → `git push` → Actions despliega →
recargas en el móvil. El código vive en Git; Drive solo guarda los datos.
