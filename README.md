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
