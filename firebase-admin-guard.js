(() => {
  const mostrarMensaje = mensaje => {
    document.body.innerHTML = `<main style="max-width:640px;margin:12vh auto;padding:24px;font:16px sans-serif;text-align:center"><h1>Acceso administrativo</h1><p>${mensaje}</p><a href="index.html">Volver al inicio</a></main>`;
    document.body.style.visibility = "visible";
  };
  const config = window.FIREBASE_CONFIG;
  const configurado = window.firebase && config &&
    config.apiKey && !config.apiKey.startsWith("REPLACE_") &&
    config.projectId && !config.projectId.startsWith("YOUR_") &&
    config.appId && !config.appId.startsWith("REPLACE_");

  if (!configurado) {
    mostrarMensaje("Firebase no está configurado. Configura firebase-config.js para continuar.");
    return;
  }

  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
    const auth = app.auth();
    auth.onAuthStateChanged(async user => {
      if (!user) {
        location.replace("index.html");
        return;
      }

      try {
        const token = await user.getIdTokenResult();
        if (token.claims.admin !== true) {
          location.replace("index.html");
          return;
        }

        document.body.style.visibility = "visible";
        const nombre = document.getElementById("admUsuarioNom");
        if (nombre) nombre.textContent = user.displayName || user.email || "Administrador";
        const script = document.createElement("script");
        script.src = "pdf_storage.js";
        script.onload = () => {
          const adminScript = document.createElement("script");
          adminScript.src = "admin.js";
          document.body.appendChild(adminScript);
        };
        script.onerror = () => mostrarMensaje("No se pudo cargar el módulo de administración.");
        document.body.appendChild(script);
      } catch (error) {
        console.error("No se pudieron comprobar los permisos administrativos:", error);
        location.replace("index.html");
      }
    }, error => {
      console.error("No se pudo comprobar la sesión de Firebase:", error);
      mostrarMensaje("No se pudo validar la sesión. Recarga la página e inténtalo nuevamente.");
    });
  } catch (error) {
    console.error("No se pudo inicializar Firebase en administración:", error);
    mostrarMensaje("No se pudo iniciar Firebase. Comprueba la configuración e inténtalo nuevamente.");
  }
})();
