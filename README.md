# Expediente Virtual de Derecho

## Ejecutar localmente en Windows

1. Abre PowerShell en la carpeta del proyecto.
2. Ejecuta `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1`.
3. Abre `http://localhost:8123/`.

El servidor local genera un índice actualizado con todos los PDF de
`expedientes/`, incluidas sus subcarpetas. La aplicación añade los documentos
encontrados al expediente disponible y guarda los datos y el índice en el
navegador. En la ficha de un expediente puedes guardar los PDF en caché para
consultarlos sin conexión.

Los documentos y los datos reales permanecen en el equipo local. No los subas a
un repositorio público ni publiques una copia del servidor local.

## Configurar el chatbot con OpenAI

El chatbot utiliza una clave de OpenAI únicamente desde el servidor local. No
guardes la clave en `ui.js`, `index.html` ni en ningún archivo publicado.

1. Crea un archivo `.env` en la raíz del proyecto.
2. Agrega una línea como `OPENAI_API_KEY=tu_clave_secreta`.
3. Opcionalmente agrega `OPENAI_MODEL=gpt-4o-mini`.
4. Reinicia `start-local.ps1` y usa el asistente desde `http://localhost:8123/`.

`.env` está incluido en `.gitignore`. Si compartes el equipo o el proyecto,
puedes configurar `OPENAI_API_KEY` como variable de entorno del sistema en
lugar de crear el archivo.

GitHub Pages es un servidor estático: no puede enumerar carpetas ni acceder a
los archivos locales del equipo. El sitio de Pages permite seleccionar la
carpeta del proyecto (o `expedientes/`) desde el navegador: los PDF y, si se
selecciona la carpeta del proyecto, `data/expedientes.json` se procesan y
guardan solo en ese navegador. No se cargan al repositorio ni se envían al
servidor. Usa «Olvidar datos de este navegador» para eliminarlos.

Para publicar la aplicación, configura **Settings → Pages → Build and
deployment → Source: GitHub Actions**. El flujo de `.github/workflows/deploy.yml`
desplegará automáticamente los cambios enviados a `main`.

El repositorio público no debe contener expedientes reales ni PDF judiciales.

## Autenticación compartida con Firebase

Las cuentas de acceso se gestionan con Firebase Authentication (correo y
contraseña), no con `localStorage`; así, cada persona puede iniciar sesión
desde su propio navegador y la autenticación no depende del servidor local.
No se necesita Firestore para administrar estas cuentas.

Antes de publicar:

1. Crea un proyecto en Firebase Console y agrega una aplicación web.
2. En **Authentication → Sign-in method**, habilita **Email/Password**.
3. En **Authentication → Settings → Authorized domains**, agrega
   `mariajose152003.github.io`.
4. Copia la configuración de la aplicación web en `firebase-config.js`
   (campos `apiKey`, `authDomain`, `projectId` y `appId`). Esa configuración
   web es pública; nunca pegues una clave de cuenta de servicio o privada en
   el repositorio.
5. Publica los cambios en GitHub Pages y prueba el registro y el inicio de
   sesión con una cuenta nueva.

El proyecto incluye valores de ejemplo en `firebase-config.js`, por lo que la
autenticación permanecerá desactivada hasta reemplazarlos por los de tu
proyecto. El panel de administración solo se carga para usuarios con el custom
claim `admin`; ese permiso debe asignarse desde un entorno confiable con Firebase
Admin SDK, nunca desde la página pública.

## PIBbLE en GitHub Pages

La interfaz de PIBbLE, su imagen y el respaldo local se muestran correctamente
en GitHub Pages. Sin embargo, GitHub Pages no puede ejecutar `start-local.ps1`
ni guardar de forma segura la clave de OpenAI. Por seguridad, la clave solo se
usa en el servidor local mediante `.env`. En Pages el chat conserva su interfaz
y las respuestas locales básicas, pero no puede conectar directamente a la API
hasta contar con un backend HTTPS protegido.
