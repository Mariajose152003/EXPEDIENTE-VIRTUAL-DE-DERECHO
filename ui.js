/* ================================================================
   ui.js — Interfaz "Consulta de Expedientes Judiciales" (diseño PJ)
   Depende de app.js (DB_EXPS, DIST, INST, ESP, $, norm, fill, cargarDB)
================================================================ */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const cap1 = s => { s = String(s||"").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
let cargaInicialDatos = Promise.resolve();

/* ===================== TOAST ===================== */
let toastT;
function toast(m) {
  $("toast-msg").textContent = m;
  $("toast").classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => $("toast").classList.remove("show"), 3000);
}

/* ===================== MODAL DE ADVERTENCIA (SIMULACIÓN ACADÉMICA) ===================== */
const modalAdv = $("modalAdvertencia");
if ($("btnEntendido")) {
  $("btnEntendido").onclick = () => {
    if (modalAdv) modalAdv.classList.add("adv-hidden");
    const uInput = $("lUser");
    if (uInput) uInput.focus();
  };
}
if ($("btnVerAdvertencia")) {
  $("btnVerAdvertencia").onclick = () => {
    if (modalAdv) modalAdv.classList.remove("adv-hidden");
  };
}

/* ===================== PASSWORD TOGGLE Y QUICK ACCESS ===================== */
if ($("btnTogglePass")) {
  $("btnTogglePass").onclick = () => {
    const p = $("lPass");
    const isPass = p.type === "password";
    p.type = isPass ? "text" : "password";
    $("btnTogglePass").innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
  };
}
/* ===================== AUTENTICACIÓN ===================== */
const sha = async t => [...new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))
)].map(b => b.toString(16).padStart(2, "0")).join("");

const HASH_123456 = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // sha256("123456")
const DEFAULT_USERS = {
  usuario: { h: HASH_123456, nombre: "Usuario Judicial" },
  admin:   { h: HASH_123456, nombre: "Administrador del Sistema" },
  harry:   { h: HASH_123456, nombre: "Administrador del Sistema" }
};
const users = () => ({ ...DEFAULT_USERS, ...JSON.parse(localStorage.getItem("sice_users") || "{}") });
let registro = false, finSesion = 0, timer = null;

// Relleno automático para el acceso de demostración.
$("lUser").value = "usuario";
$("lPass").value = "123456";

$("btnAutocompletar").onclick = () => {
  if (registro) $("btnModo").click();
  $("lUser").value = "usuario";
  $("lPass").value = "123456";
  $("loginMsg").className = "msg ok";
  $("loginMsg").textContent = "Credenciales de demostración cargadas.";
  $("lUser").dispatchEvent(new Event("input", { bubbles: true }));
  $("lPass").dispatchEvent(new Event("input", { bubbles: true }));
  $("btnLogin").focus();
};

$("btnModo").onclick = () => {
  registro = !registro;
  $("btnLogin").dataset.registro = registro ? "1" : "0";
  const idiomaActual = $("selectorIdioma").value;
  const traducciones = TRADUCCIONES_UI[idiomaActual];
  $("tituloLogin").textContent = registro
    ? (idiomaActual === "es" ? "Crear cuenta" : idiomaActual === "qu" ? "Cuenta ruwaq" : "Cuenta lurayaña")
    : (traducciones?.loginTitle || "Iniciar Sesión");
  $("btnLogin").innerHTML = registro
    ? `<span>${idiomaActual === "es" ? "REGISTRARME" : idiomaActual === "qu" ? "QILLQAKUY" : "QILLQT'AYAÑA"}</span><i class="fa-solid fa-user-plus"></i>`
    : `<span>${traducciones?.loginButton || "INGRESAR AL SISTEMA"}</span><i class="fa-solid fa-arrow-right-to-bracket"></i>`;
  $("btnModo").textContent = registro
    ? (idiomaActual === "es" ? "Ya tengo cuenta" : idiomaActual === "qu" ? "Ñuqap cuentasmi kachkan" : "Cuentajan utjitu")
    : (traducciones?.registerLink || "¿No tienes cuenta? Regístrate");
  $("lblNombre").hidden = !registro;
  $("btnAutocompletar").hidden = registro;
  $("loginMsg").textContent = "";
};

$("formLogin").onsubmit = async e => {
  e.preventDefault();
  const u = $("lUser").value.trim().toLowerCase(), h = await sha($("lPass").value), db = users(), m = $("loginMsg");
  if (registro) {
    const local = JSON.parse(localStorage.getItem("sice_users") || "{}");
    if (db[u]) { m.className = "msg"; return m.textContent = "Ese usuario ya existe."; }
    local[u] = { h, nombre: $("lNombre").value.trim() || u };
    localStorage.setItem("sice_users", JSON.stringify(local));
    $("btnModo").click();
    m.className = "msg ok"; m.textContent = "¡Cuenta creada con éxito! Ya puedes ingresar.";
  } else {
    if (!db[u] || db[u].h !== h) {
      m.className = "msg"; m.textContent = "Usuario o contraseña incorrectos.";
      $("formLogin").classList.remove("shake"); void $("formLogin").offsetWidth; $("formLogin").classList.add("shake");
      return;
    }
    sessionStorage.setItem("sice_sesion", u);
    entrar(u, db[u].nombre);
  }
};

function entrar(usuario, nombre) {
  if (modalAdv) modalAdv.classList.add("adv-hidden");
  document.body.classList.add("app-active");
  $("vistaLogin").hidden = true;
  $("vistaApp").hidden = false;
  $("usuario").textContent = nombre;
  $("btnAdmin").hidden = !(usuario === ADMIN_USER || usuario === "admin");
  finSesion = Date.now() + 15 * 60000;
  clearInterval(timer); timer = setInterval(reloj, 1000); reloj();
  generateCaptcha();
  mostrarVista("busqueda");
}
function salir() { sessionStorage.removeItem("sice_sesion"); location.reload(); }
$("btnSalir").onclick = salir;

/* ===================== IDIOMA Y ACCESIBILIDAD ===================== */
const LABELS_IDIOMA = {
  es: "Español",
  qu: "Quechua",
  ay: "Aymara"
};

const PALABRAS_TRADUCIDAS = {
  qu: {
    "Búsqueda":"Maskay","Expedientes":"Expedientekuna","Expediente":"Expediente","Inicio":"Qallariy",
    "Usuario":"Runa","Contraseña":"Chimpu","Nombre":"Suti","completo":"hunt'a","Ingresar":"Yaykuy",
    "Sistema":"Sistema","Consultar":"Maskay","Filtros":"Akllanakuna","Código":"Chimpu",
    "Accesibilidad":"Chaskiy","Idioma":"Rimay","Aymara":"Aymara","Quechua":"Quechua","Español":"Español",
    "Daltonismo":"Llimpi pantaq","Texto":"Qillqa","grande":"Hatun","Alto":"Sumaq","contraste":"llimpiy",
    "Aumentar":"Hatunyachiy","espaciado":"Ch'usaq","Restaurar":"Kutichiy","Datos":"Willakuy",
    "DNI":"DNI","no encontrado":"mana tarisqa","No":"Mana","se encontró":"tarirusqachu",
    "en":"-","la":"-","base":"hallch'a","datos":"willakuy","Nombres":"Sutikuna","Apellidos":"Apellidokuna",
    "Sexo":"Qari/warmi","Nacimiento":"Paqarisqa","Civil":"Civil","Estado":"Imayna",
    "Distrito":"Distritu","Provincia":"Provincya","Departamento":"Suyu","Dirección":"Wasiykiti",
    "Imprimir":"Imprimi","Reporte":"Willakuy","Resumen":"Uchuy willakuy","Inteligente":"Yachay",
    "Examinar":"Qhawariy","Caso":"Qayllana","Imprimir":"Imprimi","Volver":"Kutiy",
    "Documento":"Qillqa","Documentos":"Qillqakuna","Visualizar":"Qhaway","Guardar":"Waqaychay",
    "Actuaciones":"Ruwanakuna","Fecha":"Pacha","Acto":"Ruwa","Procesal":"Juchuy",
    "Gestión":"Kamachiy","Línea":"Seqe","Tiempo":"Pacha","Sujetos":"Runakuna",
    "Procesales":"Juchuy","Registrados":"Qillqasqa","SÍNTESIS":"Uchuy willakuy","Jurídica":"Ley",
    "Resultados":"Tarirusqakuna","Nueva":"Musuq","Búsqueda":"Maskay","Cerrar":"Wichqay",
    "Salir":"Lluqsiy","ayuda":"yanapa","Ayuda":"Yanapa","Preguntas":"Tapukuykuna","Frecuentes":"Sapa"
  },
  ay: {
    "Búsqueda":"Thaqhaña","Expedientes":"Expedientenaka","Expediente":"Expediente","Inicio":"Qalltawi",
    "Usuario":"Apnaqiri","Contraseña":"Ch'imi","Nombre":"Suti","completo":"taqpacha","Ingresar":"Mantaña",
    "Sistema":"Sistema","Consultar":"Thaqhaña","Filtros":"Ajllinakuna","Código":"Jakhuwi",
    "Accesibilidad":"Jani jark'aqaña","Idioma":"Arunta","Aymara":"Aymara","Quechua":"Quechua","Español":"Español",
    "Daltonismo":"Sami panti","Texto":"Qillqata","grande":"Jach'a","Alto":"Jach'a","contraste":"ch'amaka",
    "Aumentar":"Jayarst'aña","espaciado":"Jayakipt'a","Restaurar":"Kutxataña","Datos":"Yatiyawi",
    "DNI":"DNI","no encontrado":"jani jikxatasïti","No":"Jani","se encontró":"jikxataskiti",
    "base":"qallta","Nombres":"Sutinkana","Apellidos":"Apellidonkana","Sexo":"Chacha/warmi",
    "Nacimiento":"Jutawi","Civil":"Civil","Estado":"Kawkjaski","Distrito":"Distritu",
    "Provincia":"Provincya","Departamento":"Jach'a marka","Dirección":"Utankaña","Imprimir":"Imprimiña",
    "Reporte":"Yatiyawi","Resumen":"Jisk'a yatiyawi","Inteligente":"Yatiñani","Examinar":"Uñjaña",
    "Caso":"Pankarata","Volver":"Kutt'aña","Documento":"Qillqata","Documentos":"Qillqatana",
    "Visualizar":"Uñjaña","Guardar":"Imaña","Actuaciones":"Luratanaka","Fecha":"Urukama",
    "Acto":"Luratata","Procesal":"Justicia","Gestión":"Irpirawi","Línea":"Jakhuta","Tiempo":"Pacha",
    "Sujetos":"Runanak","Procesales":"Justicia","Registrados":"Qillqt'ata","Resultados":"Jikxatatanaka",
    "Nueva":"Machaq","Cerrar":"Jark'aña","Salir":"Mistuña","Ayuda":"Yanapa","Preguntas":"Tapunak",
    "Frecuentes":"Sapa"
  }
};

const ORIGINAL_TEXT_NODES = new WeakMap();

function traducirTextoNatural(texto, idioma) {
  if (idioma === "es" || !texto?.trim()) return texto;
  const mapa = PALABRAS_TRADUCIDAS[idioma];
  let resultado = texto;
  Object.keys(mapa).sort((a, b) => b.length - a.length).forEach(espanol => {
    const regex = new RegExp(espanol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    resultado = resultado.replace(regex, coincidencia =>
      coincidencia === coincidencia.toUpperCase() ? mapa[espanol].toUpperCase() : mapa[espanol]
    );
  });
  return resultado;
}

function traducirTodoElDOM(idioma) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodos = [];
  while (walker.nextNode()) nodos.push(walker.currentNode);
  nodos.forEach(nodo => {
    if (!nodo.nodeValue?.trim()) return;
    if (!ORIGINAL_TEXT_NODES.has(nodo)) ORIGINAL_TEXT_NODES.set(nodo, nodo.nodeValue);
    const original = ORIGINAL_TEXT_NODES.get(nodo);
    nodo.nodeValue = idioma === "es" ? original : traducirTextoNatural(original, idioma);
  });

  document.querySelectorAll("[placeholder],[title],[aria-label]").forEach(elemento => {
    ["placeholder", "title", "aria-label"].forEach(atributo => {
      const valor = elemento.getAttribute(atributo);
      if (!valor) return;
      const atributoOriginal = "data-original-" + atributo;
      if (!elemento.hasAttribute(atributoOriginal)) elemento.setAttribute(atributoOriginal, valor);
      const valorOriginal = elemento.getAttribute(atributoOriginal);
      elemento.setAttribute(atributo, idioma === "es"
        ? valorOriginal
        : traducirTextoNatural(valorOriginal, idioma));
    });
  });
}

const TRADUCCIONES_UI = {
  qu: {
    brandTitle: "PERÚ PAÍS JUSTICIA WASI",
    brandMotto: "Kusisqa justicia, allin llaqta",
    loginTitle: "Yaykuy",
    loginSubtitle: "Qillqakunata yaykuspa",
    user: "Runa",
    password: "Chimpu",
    fullName: "Hunt'a suti",
    loginButton: "SISTEMAMAN YAYKUY",
    autofill: "KIKIN HUNT'ACHAY",
    registerLink: "¿Manachu cuentayki kapun? Qillqakuy",
    warningLink: "Yachachiy yuyachiyta qhaway",
    home: "Qallariy",
    tutorials: "Yachachiq qawarinakuna",
    faq: "Tapukuykuna",
    management: "Kamachiy",
    accessibility: "Chaskiy",
    largeText: "Hatun qillqa",
    highContrast: "Sumaqllaña",
    spacing: "Ch'usaqta hatunyachiy",
    daltonism: "Llimpi pantaq",
    restore: "Kutichiy",
    searchTitle: "Expedientekunata Maskay",
    byFilters: "Akllanakuwan",
    byCode: "Expediente chimpuwan",
    consult: "Maskay"
  },
  ay: {
    brandTitle: "PERU JURISDICCIÓN UTAWJA",
    brandMotto: "Sum jach'a, suma marka",
    loginTitle: "Qillqatanaka",
    loginSubtitle: "Qillqatanaka apnaqaña",
    user: "Apnaqiri",
    password: "Ch'imi",
    fullName: "Taqpacha suti",
    loginButton: "SISTEMARU MANTAÑANI",
    autofill: "AUTOMATICO PHUQHACHANA",
    registerLink: "¿Janit cuentasïti? Qillqt'ayaña",
    warningLink: "Yatiyawi amuyt'aña",
    home: "Qalltawi",
    tutorials: "Yatiqañ qhananchäwi",
    faq: "Tapunak",
    management: "Irpirawi",
    accessibility: "Jani jark'aqaña",
    largeText: "Jach'a qillqata",
    highContrast: "Ch'amaka uñana",
    spacing: "Jayarst'a",
    daltonism: "Sami panti",
    restore: "Wasitat kutxataña",
    searchTitle: "Expedientenkisa thaqhaña",
    byFilters: "Ajllinakampi",
    byCode: "Expediente jakhuwimpi",
    consult: "Thaqhaña"
  }
};

function aplicarIdioma(idioma) {
  const traducciones = TRADUCCIONES_UI[idioma];
  document.documentElement.lang = idioma;
  traducirTodoElDOM(idioma);
  document.querySelectorAll("[data-i18n]").forEach(elemento => {
    if (!elemento.dataset.i18nOriginal) elemento.dataset.i18nOriginal = elemento.textContent;
  });
  document.querySelectorAll("[data-i18n]").forEach(elemento => {
    if (traducciones?.[elemento.dataset.i18n]) {
      elemento.textContent = traducciones[elemento.dataset.i18n];
    }
  });
  if (idioma === "es") {
    document.querySelectorAll("[data-i18n]").forEach(elemento => {
      elemento.textContent = elemento.dataset.i18nOriginal;
    });
  }
  const mapaIds = {
    tituloLogin: ["loginTitle"],
    btnLogin: ["loginButton"],
    btnAutocompletar: ["autofill"],
    btnModo: ["registerLink"],
    btnConsultar: ["consult"]
  };
  Object.entries(mapaIds).forEach(([id, [clave]]) => {
    const elemento = $(id);
    if (!elemento) return;
    if (idioma === "es") return;
    const traduccion = traducciones?.[clave];
    if (!traduccion) return;
    if (id === "btnLogin") elemento.innerHTML = `<span>${traduccion}</span><i class="fa-solid fa-arrow-right-to-bracket"></i>`;
    else if (id === "btnAutocompletar") elemento.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i><span>${traduccion}</span>`;
    else if (elemento.children.length) {
      const span = elemento.querySelector("span");
      if (span) span.textContent = traduccion;
    } else elemento.textContent = traduccion;
  });
  if (idioma === "es") {
    if ($("btnLogin").dataset.registro === "1") {
      $("btnLogin").innerHTML = '<span>REGISTRARME</span><i class="fa-solid fa-user-plus"></i>';
    } else {
      $("btnLogin").innerHTML = '<span>INGRESAR AL SISTEMA</span><i class="fa-solid fa-arrow-right-to-bracket"></i>';
    }
  }
  localStorage.setItem("sice_idioma", idioma);
}

function configurarAccesibilidad() {
  const panel = $("panelAccesibilidad");
  $("btnAccesibilidad").onclick = () => {
    panel.hidden = !panel.hidden;
    $("btnAccesibilidad").setAttribute("aria-expanded", String(!panel.hidden));
  };
  $("btnCerrarAccesibilidad").onclick = () => {
    panel.hidden = true;
    $("btnAccesibilidad").setAttribute("aria-expanded", "false");
  };

  $("btnDaltonismo").onclick = () => {
    $("panelDaltonismo").hidden = !$("panelDaltonismo").hidden;
    $("btnDaltonismo").setAttribute("aria-expanded", String(!$("panelDaltonismo").hidden));
  };

  const modosDaltonismo = ["protanopia", "deuteranopia", "tritanopia"];
  document.querySelectorAll("[data-daltonismo]").forEach(boton => {
    boton.onclick = () => {
      const modo = boton.dataset.daltonismo;
      document.body.classList.remove(
        "daltonismo-protanopia",
        "daltonismo-deuteranopia",
        "daltonismo-tritanopia"
      );
      document.querySelectorAll("[data-daltonismo]").forEach(b => b.classList.remove("active"));

      if (modosDaltonismo.includes(modo)) {
        document.body.classList.add("daltonismo-" + modo);
        boton.classList.add("active");
        $("btnDaltonismo").classList.add("active");
        localStorage.setItem("sice_daltonismo", modo);
        toast("Modo daltonismo aplicado: " + modo);
      } else {
        $("btnDaltonismo").classList.remove("active");
        localStorage.removeItem("sice_daltonismo");
        toast("Filtro de daltonismo desactivado");
      }
    };
  });

  const modoDaltonismoGuardado = localStorage.getItem("sice_daltonismo");
  if (modosDaltonismo.includes(modoDaltonismoGuardado)) {
    document.body.classList.add("daltonismo-" + modoDaltonismoGuardado);
    $("btnDaltonismo").classList.add("active");
    const botonGuardado = document.querySelector('[data-daltonismo="' + modoDaltonismoGuardado + '"]');
    if (botonGuardado) botonGuardado.classList.add("active");
  }

  const opciones = [
    ["btnTextoGrande", "texto-grande"],
    ["btnAltoContraste", "alto-contraste"],
    ["btnEspaciado", "espaciado-lectura"]
  ];
  opciones.forEach(([id, clase]) => {
    $(id).onclick = () => {
      document.body.classList.toggle(clase);
      $(id).classList.toggle("active", document.body.classList.contains(clase));
      localStorage.setItem("sice_accesibilidad_" + clase, document.body.classList.contains(clase) ? "1" : "0");
    };
  });
  opciones.forEach(([id, clase]) => {
    if (localStorage.getItem("sice_accesibilidad_" + clase) === "1") {
      document.body.classList.add(clase);
      $(id).classList.add("active");
    }
  });

  $("btnRestaurarAccesibilidad").onclick = () => {
    opciones.forEach(([id, clase]) => {
      document.body.classList.remove(clase);
      $(id).classList.remove("active");
      localStorage.removeItem("sice_accesibilidad_" + clase);
    });
    document.body.classList.remove("daltonismo-protanopia", "daltonismo-deuteranopia", "daltonismo-tritanopia");
    document.querySelectorAll("[data-daltonismo]").forEach(b => b.classList.remove("active"));
    localStorage.removeItem("sice_daltonismo");
    $("panelDaltonismo").hidden = true;
    $("btnDaltonismo").setAttribute("aria-expanded", "false");
    $("btnDaltonismo").classList.remove("active");
    toast("Preferencias de accesibilidad restauradas");
  };

  $("selectorIdioma").onchange = e => {
    const idioma = e.target.value;
    aplicarIdioma(idioma);
    toast(`Idioma cambiado a ${LABELS_IDIOMA[idioma]}`);
  };
  const idiomaGuardado = localStorage.getItem("sice_idioma");
  if (idiomaGuardado && LABELS_IDIOMA[idiomaGuardado]) {
    $("selectorIdioma").value = idiomaGuardado;
    aplicarIdioma(idiomaGuardado);
  } else {
    aplicarIdioma("es");
  }
}

configurarAccesibilidad();

let idiomaNlpEnCurso = false;
const observadorIdiomas = new MutationObserver(() => {
  if (idiomaNlpEnCurso) return;
  const idioma = localStorage.getItem("sice_idioma") || "es";
  if (idioma === "es") return;
  idiomaNlpEnCurso = true;
  traducirTodoElDOM(idioma);
  idiomaNlpEnCurso = false;
});
observadorIdiomas.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

function reloj() {
  const n = new Date(), p = v => String(v).padStart(2, "0"), r = Math.max(0, finSesion - Date.now());
  $("current-datetime").textContent = `Fecha: ${n.toLocaleDateString("es-PE")} Hora: ${n.toLocaleTimeString("es-PE")}`;
  $("sesionRestante").textContent = `${p(Math.floor(r / 60000))}:${p(Math.floor(r % 60000 / 1000))}`;
  if (!r) { alert("Tu sesión expiró."); salir(); }
}

/* ===================== VISTAS ===================== */
function mostrarVista(v) {
  ["busqueda", "resultados", "detalle"].forEach(x => $("vista-" + x).hidden = x !== v);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("navInicio").onclick = e => { e.preventDefault(); mostrarVista("busqueda"); generateCaptcha(); };
$("navVideos").onclick = e => { e.preventDefault(); toast("Videotutoriales disponibles próximamente"); };
$("navAyuda").onclick  = e => { e.preventDefault(); abrirIA(); };
$("btnNuevaBusq").onclick = () => { mostrarVista("busqueda"); generateCaptcha(); };
$("btnVolverLista").onclick = () => mostrarVista(ultimosResultados.length ? "resultados" : "busqueda");

/* ===================== CAPTCHA ===================== */
let capTxt = "";
function generateCaptcha() {
  const ch = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; capTxt = "";
  for (let i = 0; i < 4; i++) capTxt += ch[crypto.getRandomValues(new Uint32Array(1))[0] % ch.length];
  $("captcha-text").textContent = capTxt;
  $("captcha-input").value = "";
  $("captcha-input").classList.remove("err");
}
$("capRef").onclick = generateCaptcha;
$("capVoz").onclick = () => {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance([...capTxt].join(" ")); u.lang = "es-PE"; speechSynthesis.speak(u);
};

/* ===================== FORMULARIO Y FILTROS ===================== */
const DIST_OPTS = { PUNO: "PUNO", LIMA: "LIMA", AREQUIPA: "AREQUIPA", CUSCO: "CUSCO" };
const INST_OPTS = {
  "JUZGADO DE TRABAJO": "JUZGADO DE TRABAJO",
  "JUZGADO ESPECIALIZADO": "JUZGADO ESPECIALIZADO",
  "JUZGADO PENAL": "JUZGADO PENAL",
  "JUZGADO CIVIL": "JUZGADO CIVIL",
  "JUZGADO DE PAZ LETRADO": "JUZGADO DE PAZ LETRADO",
  "SALA SUPERIOR": "SALA SUPERIOR"
};
const ESP_OPTS = {
  "LABORAL": "LABORAL",
  "CIVIL": "CIVIL",
  "PENAL": "PENAL",
  "FAMILIA CIVIL": "FAMILIA CIVIL",
  "COMERCIAL": "COMERCIAL"
};

fill($("fDist"), DIST_OPTS, "--SELECCIONAR--");
fill($("fInst"), INST_OPTS, "--SELECCIONAR--");
fill($("fEsp"), ESP_OPTS, "--SELECCIONAR--");
$("fAnio").innerHTML = "<option value=''>--SELECCIONAR--</option>" +
  Array.from({ length: 15 }, (_, i) => 2026 - i).map(a => `<option>${a}</option>`).join("");

const codigoExpedientePrecargado = "00957-2022-0-2111-JR-LA-01";

let modo = "filtros";
document.querySelectorAll(".stab").forEach(t => t.onclick = () => {
  modo = t.dataset.t;
  document.querySelectorAll(".stab").forEach(x => x.classList.toggle("on", x === t));
  $("tab-filtros").hidden = modo !== "filtros";
  $("tab-codigo").hidden = modo !== "codigo";
  $("busqMsg").textContent = "";
});

function autocompletarBusqueda() {
  modo = "filtros";
  document.querySelectorAll(".stab").forEach(b => b.classList.toggle("on", b.dataset.t === "filtros"));
  $("tab-filtros").hidden = false;
  $("tab-codigo").hidden = true;

  $("fDist").value = "PUNO";
  $("fInst").value = "JUZGADO DE TRABAJO";
  $("fEsp").value = "LABORAL";
  $("fAnio").value = "2022";
  $("fNum").value = "00957";
  $("fParte").value = "CHOQUE TICONA";
  codigoExpedientePrecargado.split("-").forEach((parte, i) => {
    $("c" + (i + 1)).value = parte;
  });

  [$("fDist"), $("fInst"), $("fEsp"), $("fAnio"), $("fNum"), $("fParte")].forEach(elemento => {
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
    elemento.dispatchEvent(new Event("change", { bubbles: true }));
  });

  $("captcha-input").value = capTxt;
  $("captcha-input").classList.remove("err");
  $("busqMsg").className = "msg ok";
  $("busqMsg").textContent = "Formulario, código de expediente y CAPTCHA completados.";
  toast("Todos los datos de demostración fueron cargados");
}

$("btnAutocompletarBusqueda").addEventListener("click", autocompletarBusqueda);
window.autocompletarBusqueda = autocompletarBusqueda;

// Autoavance entre casillas del código
for (let i = 1; i <= 7; i++) {
  $("c" + i).addEventListener("input", ev => {
    const el = ev.target;
    if (i === 1 && el.value.split("-").length === 7) {   // pegaron el código completo
      el.value.split("-").forEach((v, k) => $("c" + (k + 1)).value = v.toUpperCase());
      return;
    }
    if (el.classList.contains("up")) el.value = el.value.toUpperCase();
    if (el.value.length >= el.maxLength && i < 7) $("c" + (i + 1)).focus();
  });
}
document.querySelectorAll("[data-ej]").forEach(b => b.onclick = () => {
  b.dataset.ej.split("-").forEach((v, i) => $("c" + (i + 1)).value = v);
  toast(`Código ${b.dataset.ej} cargado`);
});

$("formBusq").onsubmit = e => {
  e.preventDefault();
  const m = $("busqMsg"); m.textContent = "";
  const ci = $("captcha-input");

  if (ci.value.trim().toUpperCase() !== capTxt) {
    ci.classList.add("err", "shake"); setTimeout(() => ci.classList.remove("shake"), 400);
    toast("Captcha incorrecto");
    m.textContent = "El código de verificación es incorrecto.";
    return generateCaptcha();
  }

  const parteRaw = $("fParte").value.trim(), parte = norm(parteRaw);
  if (parteRaw && parte.length < 3) return m.textContent = "Si escribes la parte, usa al menos 3 letras.";

  let f;
  if (modo === "filtros") {
    const numVal = $("fNum").value.trim();
    if (!numVal) return m.textContent = "Ingresa el N° de Expediente (*).";
    const num = numVal.padStart(5, "0");
    const d = $("fDist").value;
    const ins = $("fInst").value;
    const es = $("fEsp").value;
    const an = $("fAnio").value;

    f = x => {
      const codigo = String(x.codigo || "").split("-");
      const secuencia = x.sec || codigo[0] || "";
      const anioExpediente = x.anio || codigo[1] || "";
      const distrito = x.dist || codigo[3] || "";
      const instanciaCodigo = x.inst || codigo[4] || "";
      const instancia = ({ JR: "JUZGADO ESPECIALIZADO", JP: "JUZGADO DE PAZ LETRADO", SP: "SALA SUPERIOR" })[instanciaCodigo] || instanciaCodigo;
      const especialidad = x.esp || ({ LA: "LABORAL", CI: "CIVIL", PE: "PENAL", FC: "FAMILIA CIVIL", CO: "COMERCIAL" })[codigo[5]] || "";

      // 1. Número de expediente (acepta ceros iniciales opcionales)
      const matchNum = secuencia === num || parseInt(secuencia, 10) === parseInt(numVal, 10);
      if (!matchNum) return false;

      // 2. Distrito Judicial (Puno cubre 2101 y 2111)
      if (d) {
        if (d === "PUNO") {
          if (distrito !== "2101" && distrito !== "2111" && !norm(x.reporte?.distritoJudicial).includes("PUNO")) return false;
        } else if (distrito !== DIST[d] && !norm(x.reporte?.distritoJudicial).includes(norm(d))) {
          return false;
        }
      }

      // 3. Instancia
      if (ins) {
        const insNorm = norm(ins);
        const xInst = norm(instancia);
        const xOrg = norm(x.reporte?.organoJurisdiccional || "");
        let mInst = false;
        if (xInst === insNorm || xOrg.includes(insNorm)) mInst = true;
        else if (insNorm.includes("TRABAJO") && (xOrg.includes("TRABAJO") || especialidad === "LABORAL")) mInst = true;
        else if (insNorm.includes("PENAL") && (xOrg.includes("PENAL") || especialidad === "PENAL")) mInst = true;
        else if (insNorm.includes("CIVIL") && (xOrg.includes("CIVIL") || especialidad === "CIVIL")) mInst = true;
        else if (insNorm.includes("PAZ") && (instanciaCodigo === "JP" || xOrg.includes("PAZ"))) mInst = true;
        else if (insNorm.includes("SUPERIOR") && (instanciaCodigo === "SP" || xOrg.includes("SUPERIOR"))) mInst = true;
        else if (insNorm.includes("ESPECIALIZADO") && (instanciaCodigo === "JR" || xOrg.includes("ESPECIALIZADO"))) mInst = true;
        if (!mInst) return false;
      }

      // 4. Especialidad
      if (es) {
        const esNorm = norm(es);
        const xEsp = norm(especialidad);
        const xEspNom = norm(x.reporte?.especialidad || "");
        let mEsp = false;
        if (xEsp === esNorm || xEspNom === esNorm) mEsp = true;
        else if (esNorm === "LABORAL" && (especialidad === "LABORAL" || xEspNom.includes("LABORAL"))) mEsp = true;
        else if (esNorm === "CIVIL" && (especialidad === "CIVIL" || xEspNom.includes("CIVIL"))) mEsp = true;
        else if (esNorm === "PENAL" && (especialidad === "PENAL" || xEspNom.includes("PENAL"))) mEsp = true;
        else if (esNorm.includes("FAMILIA") && (especialidad === "FAMILIA CIVIL" || xEspNom.includes("FAMILIA"))) mEsp = true;
        else if (esNorm === "COMERCIAL" && (especialidad === "COMERCIAL" || xEspNom.includes("COMERCIAL"))) mEsp = true;
        if (!mEsp) return false;
      }

      // 5. Año
      if (an && anioExpediente !== an) return false;
      return true;
    };
  } else {
    const v = [1, 2, 3, 4, 5, 6, 7].map(i => $("c" + i).value.trim().toUpperCase());
    if (v.some(x => !x)) return m.textContent = "Completa los 7 campos del código.";
    f = x => x.codigo === v.join("-");
  }

  const r = DB_EXPS.filter(x => {
    if (!f(x)) return false;
    if (parte.length >= 3) {
      return (x.partes || []).some(p => {
        const texto = norm(`${p.nombres || ""} ${p.apellidoPaterno || ""} ${p.apellidoMaterno || ""}`);
        return texto.includes(parte) || parte.split(" ").every(w => w.length < 3 || texto.includes(w));
      });
    }
    return true;
  });

  toast(r.length ? `Se encontraron ${r.length} expediente(s)` : "Sin coincidencias");
  mostrarResultados(r);
  generateCaptcha();
};

/* ===================== RESULTADOS ===================== */
let ultimosResultados = [];
const estadoClase = e => /CONCLUIDO|ARCHIVADO/.test(e || "") ? "st-gray" : /EJECUCION|JUDICATA/.test(e || "") ? "st-amber" : "st-green";

function mostrarResultados(r) {
  ultimosResultados = r;
  $("res-count").textContent = `Se encontraron ${r.length} expediente(s) vinculados a la búsqueda`;
  $("res-update").textContent = `Actualizado: ${new Date().toLocaleString("es-PE")}`;
  $("res-tbody").innerHTML = r.length ? r.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="exp-link" data-i="${i}">${esc(x.codigo)}</span></td>
      <td class="up">${esc(x.reporte?.materia)}</td>
      <td class="up">${esc(x.reporte?.organoJurisdiccional || INST[x.inst] || x.inst)}</td>
      <td class="c"><span class="st-badge ${estadoClase(x.reporte?.estado)}">${esc(x.reporte?.estado || "ACTIVO")}</span></td>
      <td class="c"><button class="btn-ver" data-i="${i}">VER</button></td>
    </tr>`).join("")
    : `<tr><td colspan="6" class="vacio"><i class="fa-regular fa-folder-open"></i> No se encontraron expedientes. Verifica el código, año, especialidad y la parte.</td></tr>`;
  $("res-tbody").querySelectorAll("[data-i]").forEach(b => b.onclick = () => mostrarDetalle(r[b.dataset.i]));
  mostrarVista("resultados");
}

/* ===================== DETALLE ===================== */
let expActual = null, paginaActual = 1;
const ACTS_POR_PAG = 5;

document.querySelectorAll(".dtab").forEach(b => b.onclick = () => switchDetalleTab(b.dataset.d));
function switchDetalleTab(name) {
  document.querySelectorAll(".dtab").forEach(b => b.classList.toggle("on", b.dataset.d === name));
  document.querySelectorAll(".dpane").forEach(p => p.hidden = p.id !== "cont-" + name);
}

function mostrarDetalle(x) {
  expActual = x; paginaActual = 1;
  const rp = x.reporte || {}, pr = x.progreso || {};
  const concluido = /CONCLUIDO|ARCHIVADO/.test(rp.estado || "");

  // Cabecera
  $("det-titulo").textContent = "N° " + x.codigo;
  $("det-subtitulo").textContent = [`Distrito Judicial de ${cap1(rp.distritoJudicial)}`, rp.organoJurisdiccional, `Etapa: ${cap1(rp.etapaProcesal)}`].filter(Boolean).join(" • ");
  $("det-badge").textContent = concluido ? "Expediente Concluido" : "Expediente Activo";
  $("det-badge").classList.toggle("closed", concluido);

  renderMapa(x);
  renderResumen(x);
  renderMetadatos(x);
  renderPartes(x.partes || []);
  renderActuaciones();
  renderTimeline(x);

  switchDetalleTab("resumen");
  mostrarVista("detalle");
}

/* ---------- Mapa procesal predictivo ---------- */
function iconoEtapa(n) {
  n = norm(n);
  if (/DEMANDA|PRESENTACION|DENUNCIA/.test(n) && !/CALIFIC|ADMISI/.test(n)) return "fa-file-signature";
  if (/CALIFIC|ADMISI|ADMITE/.test(n)) return "fa-magnifying-glass";
  if (/CONTEST|CONTRADIC|ABSOL/.test(n)) return "fa-comment-dots";
  if (/AUDIENCIA|SANEAMIENTO|PRUEBA/.test(n)) return "fa-users";
  if (/SENTENCIA|FALLO/.test(n)) return "fa-gavel";
  if (/APELAC|IMPUGN|NULIDAD|RECURSO/.test(n)) return "fa-file-arrow-up";
  if (/SALA|SUPERIOR|CASACION/.test(n)) return "fa-building-columns";
  if (/EJECUC/.test(n)) return "fa-hand-holding-dollar";
  if (/ARCHIV|CONCLU/.test(n)) return "fa-box-archive";
  return "fa-circle-dot";
}
function etapasMapa(x) {
  const pr = x.progreso || {};
  let et = (pr.etapas || []).map(e => ({ ...e }));
  if (!et.length) et = [{ nombre: "Demanda", estado: "done" }, { nombre: "Calificación", estado: "current" }];
  if (!et.some(e => e.estado === "current")) {
    const k = et.findIndex(e => e.estado !== "done");
    if (k >= 0) et[k].estado = "current";
  }
  if (!et.some(e => e.estado === "pending")) {
    const concl = /CONCLUIDO|ARCHIVADO/.test(x.reporte?.estado || "");
    if (!concl) et.push({ nombre: "Archivo Definitivo", estado: "pending" });
  }
  const acts = x.actuaciones || [];
  return et.map(e => {
    if (e.fecha) return e;
    const n = norm(e.nombre);
    let f = "";
    if (/DEMANDA/.test(n)) {
      const a = acts.find(act => /DEMANDA/i.test(act.acto));
      if (a) f = a.fecha;
    } else if (/CALIFIC/.test(n)) {
      const a = acts.find(act => /ADMISI|CALIFIC/i.test(act.acto));
      if (a) f = a.fecha;
    } else if (/CONTESTAC/.test(n)) {
      const a = acts.find(act => /CONTESTAC/i.test(act.acto));
      if (a) f = a.fecha;
    } else if (/AUDIENCIA/.test(n)) {
      const a = acts.slice().reverse().find(act => /AUDIENCIA/i.test(act.acto));
      if (a) f = a.fecha;
    } else if (/SENTENCIA/.test(n)) {
      const a = acts.find(act => /SENTENCIA/i.test(act.acto));
      if (a) f = a.fecha;
    }
    return { ...e, fecha: f };
  });
}
function renderMapa(x) {
  const et = etapasMapa(x), n = et.length;
  let cur = et.findIndex(e => e.estado === "current");
  if (cur < 0) cur = n - 1;
  const half = 50 / n;
  $("mapaTrack").innerHTML = `
    <div class="mapa-line" style="left:${half}%;right:${half}%"></div>
    <div class="mapa-fill" style="left:${half}%;width:0"></div>` +
    et.map(e => `
    <div class="mstep ${e.estado}" title="${esc(e.desc || e.nombre)}">
      <div class="mdot"><i class="fa-solid ${iconoEtapa(e.nombre)}"></i></div>
      <div class="mname">${esc(e.nombre)}</div>
      ${e.fecha ? `<div class="mdate">${esc(e.fecha)}</div>` : ""}
      ${e.estado === "current" ? `<div class="mbadge">ESTADO ACTUAL</div>` : ""}
    </div>`).join("");
  requestAnimationFrame(() => setTimeout(() => {
    const fill = $("mapaTrack").querySelector(".mapa-fill");
    if (fill && n > 1) {
      const pct = (cur / (n - 1)) * (100 - (100 / n));
      fill.style.width = pct + "%";
    }
    const c = $("mapaTrack").querySelector(".mstep.current");
    if (c) $("mapaScroll").scrollLeft = c.offsetLeft - $("mapaScroll").clientWidth / 2 + c.clientWidth / 2;
  }, 60));
}
$("mapaToggle").onclick = () => {
  const m = $("mapaToggle").parentElement;
  m.classList.toggle("collapsed");
  $("mapaToggle").setAttribute("aria-expanded", !m.classList.contains("collapsed"));
};
$("mapaPrev").onclick = () => $("mapaScroll").scrollLeft -= 280;
$("mapaNext").onclick = () => $("mapaScroll").scrollLeft += 280;

/* ---------- Resumen ---------- */
function actuacionClave(x) {
  const acts = x.actuaciones || [];
  return acts.find(a => /SENTENCIA/i.test(a.acto)) || acts[0] || null;
}
function renderResumen(x) {
  const rp = x.reporte || {}, pr = x.progreso || {};
  const caso = x.resumen || [
    `Proceso ${(rp.proceso || "judicial").toLowerCase()} sobre ${(rp.materia || "materia no registrada").toLowerCase()}, tramitado ante el ${rp.organoJurisdiccional || "órgano jurisdiccional"} del Distrito Judicial de ${cap1(rp.distritoJudicial)}, iniciado el ${rp.fechaInicio || "—"}.`,
    rp.sumilla ? `Sumilla: ${cap1(rp.sumilla)}.` : "",
    rp.observacion || "",
    pr.mensaje || ""
  ].filter(Boolean).join(" ");
  $("res-caso").textContent = caso;
  $("res-tags").innerHTML = [rp.especialidad, rp.estado, rp.etapaProcesal && "Etapa: " + rp.etapaProcesal]
    .filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
  const pct = Math.max(0, Math.min(100, +pr.porcentaje || 0));
  $("res-pct").textContent = pct + "%";
  $("res-bar").style.width = "0";
  setTimeout(() => $("res-bar").style.width = pct + "%", 80);

  const a = actuacionClave(x);
  $("res-sit-t").textContent = x.situacionResolutiva?.titulo || x.situacion?.titulo || rp.motivoConclusion || rp.estado || "EN TRÁMITE";
  $("res-sit-d").textContent = x.situacionResolutiva?.detalle || x.situacion?.detalle ||
    (a ? `En la ${cap1(a.acto)} (${a.fecha}): ${cap1(a.sumilla)}` : "Aún no se registran resoluciones relevantes.");
}

/* ---------- Metadatos ---------- */
function renderMetadatos(x) {
  const rp = x.reporte || {};
  const filas = [
    ["N° Expediente", x.codigo, "hl"],
    ["Distrito Judicial", rp.distritoJudicial ? rp.distritoJudicial + " (Provincia de San Román)" : "—"],
    ["Órgano Jurisdiccional", rp.organoJurisdiccional, "hl"],
    ["Sede", rp.sede || "—"],
    ["Especialidad / Subespecialidad", (rp.especialidad || "") + (rp.subespecialidad ? " / " + rp.subespecialidad : "")],
    ["Materia Principal", rp.materia || "—"],
    ["Proceso", rp.proceso || "—"],
    ["Cuantía", rp.cuantia || "Indeterminada (S/ 0.00 soles)"],
    ["Fecha de Ingreso / Inicio", rp.fechaInicio || "—"],
    ["Juez / Jueza", rp.juez || "—"],
    ["Especialista Legal", rp.especialistaLegal || rp.especialista || "—"],
    ["Estado del Proceso", rp.estado || "—", "ok"],
    ["Etapa Procesal", rp.etapaProcesal || "—"],
    ["Ubicación", rp.ubicacion || "—"],
    ["Sumilla", rp.sumilla || "—"],
    ["N° de Actuaciones Registradas", (x.actuaciones || []).length]
  ];
  $("meta-tbody").innerHTML = filas.map(([k, v, c]) =>
    `<tr><td>${esc(k)}</td><td class="${c || ""}">${esc(v ?? "—")}</td></tr>`).join("");
}

/* ---------- Sujetos procesales ---------- */
function renderPartes(partes) {
  if (!partes.length) { $("partes-grid").innerHTML = `<p class="muted">No hay sujetos procesales registrados.</p>`; return; }
  $("partes-grid").innerHTML = partes.map(p => {
    const rol = p.tipo || p.rol || "PARTE";
    const tipoPers = p.tipoPersona || p.tipoPers || "NATURAL";
    const nombre = p.nombres || [p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(" ");
    const rep = p.representante || p.defensa || "";
    const dark = !/DEMANDANTE|AGRAVIADO|ACTOR/.test(rol);
    return `
    <div class="pcard ${dark ? "dark" : ""}">
      <div class="pcard-h">
        <span>${esc(rol)}:</span>
        <span class="pchip ${/JUR/.test(tipoPers) ? "jur" : "nat"}">
          <i class="fa-solid ${/JUR/.test(tipoPers) ? "fa-building" : "fa-user"}"></i> ${esc(tipoPers)}
        </span>
      </div>
      <div class="pcard-b">
        <span class="pname">${esc(nombre || "—")}</span>
        ${rep ? `
        <div class="p-rep">
          <span class="p-rep-label"><i class="fa-solid fa-scale-balanced"></i> Representante / Defensa:</span>
          <b class="p-rep-val">${esc(rep)}</b>
        </div>` : ""}
      </div>
    </div>`;
  }).join("");
}

/* ---------- Actuaciones ---------- */
let docsPagina = [];
function renderActuaciones() {
  if ($("btnVerExpCompleto")) {
    const url = expActual.expedienteCompletoUrl;
    $("btnVerExpCompleto").disabled = !url;
    $("btnVerExpCompleto").onclick = () => {
      if (url) abrirVisor(url, "Expediente Completo Digitalizado N° " + expActual.codigo);
    };
  }
  const cacheButton = $("btnCachearPdfs");
  const cacheStatus = $("estadoCachePdf");
  if (cacheButton) {
    const disponible = esServidorLocal() && PDF_INDEX_FILES.length > 0 &&
      typeof window.precargarPDFs === "function";
    cacheButton.hidden = !disponible;
    cacheButton.disabled = false;
    cacheButton.onclick = async () => {
      cacheButton.disabled = true;
      cacheStatus.textContent = "Preparando documentos para guardarlos sin conexión...";
      try {
        const resultado = await window.precargarPDFs(PDF_INDEX_FILES, avance => {
          cacheStatus.textContent = `Guardando PDF ${avance.completed} de ${avance.total}...`;
        });
        cacheStatus.textContent = resultado.failed
          ? `Se guardaron ${resultado.cached} de ${resultado.total} PDF; ${resultado.failed} no se pudieron guardar. Revisa el espacio disponible e inténtalo de nuevo.`
          : `Listo: los ${resultado.cached} PDF se guardaron para consulta sin conexión.`;
      } catch (error) {
        console.error("No se pudieron guardar los PDF para consulta sin conexión:", error);
        cacheStatus.textContent = error.message || "No se pudieron guardar los PDF para consulta sin conexión.";
      } finally {
        cacheButton.disabled = false;
      }
    };
  }
  const pdfSummary = $("pdfSummary");
  if (pdfSummary) {
    pdfSummary.textContent = `${expActual.actuaciones?.length || 0} documentos vinculados · ${PDF_INDEX_FILES.length} PDF detectados en la carpeta local`;
  }
  const acts = expActual.actuaciones || [];
  const totalPags = Math.max(1, Math.ceil(acts.length / ACTS_POR_PAG));
  paginaActual = Math.min(paginaActual, totalPags);
  const pagina = acts.slice((paginaActual - 1) * ACTS_POR_PAG, paginaActual * ACTS_POR_PAG);
  docsPagina = [];
  const reg = (url, titulo) => (docsPagina.push({ url, titulo }), docsPagina.length - 1);
  const grupo = (url, titulo) => {
    if (!url) return `<div class="action-group"><button class="btn-view" disabled><i class="fa-solid fa-eye-slash"></i> No disponible</button></div>`;
    const k = reg(url, titulo);
    return `<div class="action-group">
      <button class="btn-view" data-ver="${k}"><i class="fa-solid fa-eye"></i> Ver</button>
      <button class="btn-download" data-dl="${k}"><i class="fa-solid fa-file-arrow-down"></i> Descargar</button>
    </div>`;
  };

  $("act-tbody").innerHTML = pagina.length ? pagina.map(a => {
    const docs = (a.docs && a.docs.length) ? a.docs : null;
    const gestion = docs
      ? docs.map(d => `<div style="margin-bottom:8px"><small class="muted" style="font-size:9px;font-weight:900;text-transform:uppercase">${esc(d.label)}</small><br>${grupo(d.url, `${a.acto} - ${d.label}`)}</div>`).join("")
      : grupo(a.pdfUrl, a.acto);
    const ced = (a.cedulas || []).length ? `
      <tr class="ced-row"><td colspan="4"><div class="ced-list">${a.cedulas.map(c => {
        const k = c.pdfUrl ? reg(c.pdfUrl, `Cédula ${c.numero} - ${c.parte}`) : -1;
        return `<div class="ced">
          <div>
            <div class="ced-t"><i class="fa-solid fa-envelope-open-text"></i> Notificación Cédula ${esc(c.numero)} — ${esc(c.parte)}</div>
            <div class="ced-d">Destinatario: <b>${esc(c.destinatario)}</b> · Envío: <b>${esc(c.fechaEnvio)}</b> · Entrega: <b>${esc(c.formaEntrega || "CASILLA ELECTRÓNICA")}</b></div>
          </div>
          ${k >= 0 ? `<button class="btn-view" data-ver="${k}"><i class="fa-solid fa-print"></i> Ver cédula</button>`
                   : `<button class="btn-view" disabled>No digitalizada</button>`}
        </div>`;
      }).join("")}</div></td></tr>` : "";
    return `
      <tr class="main-row">
        <td class="act-n">${esc(a.numero)}</td>
        <td class="act-date">${esc(a.fecha)}</td>
        <td>
          <span class="act-chip">${esc(a.acto)}</span>
          <p class="act-sum">${esc(a.sumilla)}</p>
          <p class="act-resp">Usuario responsable: <b>${esc(a.responsable || "—")}</b></p>
        </td>
        <td class="c">${gestion}</td>
      </tr>${ced}`;
  }).join("") : `<tr><td colspan="4" class="vacio">No hay actuaciones registradas.</td></tr>`;

  $("act-tbody").querySelectorAll("[data-ver]").forEach(b => b.onclick = () => { const d = docsPagina[b.dataset.ver]; abrirVisor(d.url, d.titulo); });
  $("act-tbody").querySelectorAll("[data-dl]").forEach(b => b.onclick = () => { const d = docsPagina[b.dataset.dl]; descargar(d.url, d.titulo); });

  // Paginación
  if (totalPags <= 1) { $("act-pag").innerHTML = ""; return; }
  let h = `<button class="pag-btn" data-p="1" ${paginaActual === 1 ? "disabled" : ""}>Inicio</button>
           <button class="pag-btn" data-p="${paginaActual - 1}" ${paginaActual === 1 ? "disabled" : ""}>&#8249;</button>`;
  for (let i = 1; i <= totalPags; i++) h += `<button class="pag-btn ${i === paginaActual ? "on" : ""}" data-p="${i}">${i}</button>`;
  h += `<button class="pag-btn" data-p="${paginaActual + 1}" ${paginaActual === totalPags ? "disabled" : ""}>&#8250;</button>
        <button class="pag-btn" data-p="${totalPags}" ${paginaActual === totalPags ? "disabled" : ""}>Fin</button>`;
  $("act-pag").innerHTML = h;
  $("act-pag").querySelectorAll(".pag-btn:not([disabled])").forEach(b => b.onclick = () => {
    paginaActual = +b.dataset.p; renderActuaciones();
    $("cont-actuaciones").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ---------- Línea de tiempo ---------- */
function renderTimeline(x) {
  const pr = x.progreso || {};
  let items = (pr.hitos || []).map(h => ({ fecha: h.fecha, titulo: h.descripcion, desc: "" }));
  if (!items.length) items = (x.actuaciones || []).slice().reverse().map(a => ({ fecha: a.fecha, titulo: a.acto, desc: a.sumilla }));
  items = items.reverse(); // más reciente primero
  const activo = (+pr.porcentaje || 0) < 100 && !/CONCLUIDO|ARCHIVADO/.test(x.reporte?.estado || "");
  $("tl-list").innerHTML = items.length ? items.map((it, i) => `
    <div class="tl-step ${i === 0 && activo ? "current" : ""}">
      <span class="tl-ico"><i class="fa-solid ${i === 0 && activo ? "fa-hourglass-half" : "fa-check-double"}"></i></span>
      <div class="tl-card">
        <span class="tl-date"><i class="fa-regular fa-calendar"></i> ${esc(it.fecha)}</span>
        <h4>${esc(it.titulo)}</h4>
        ${it.desc ? `<p>→ ${esc(it.desc)}</p>` : ""}
      </div>
    </div>`).join("") : `<p class="muted">Sin hitos registrados.</p>`;
}

/* ===================== VISOR / DESCARGA ===================== */
async function resolverUrl(url) {
  let u = String(url || "").trim();
  if (u.startsWith("idb:")) {
    try {
      const item = window.obtenerPdfLocal ? await window.obtenerPdfLocal(u) : null;
      if (item && item.blob) return { view: URL.createObjectURL(item.blob), blob: item.blob };
    } catch (err) { console.error("Error al cargar PDF local:", err); }
    return { view: "" };
  }
  // Archivos locales en carpeta expedientes/
  if (u.startsWith("expedientes/") || u.startsWith("./expedientes/") || u.startsWith("/expedientes/")) {
    const cleanPath = u.replace(/^\.\//, "").replace(/^\//, "");
    const fileUrl = new URL(cleanPath, location.href).href;
    const indexedFile = PDF_INDEX_FILES.find(file => new URL(file.url, location.href).href === fileUrl);
    let cached = null;
    try {
      cached = window.obtenerPdfCache ? await window.obtenerPdfCache(fileUrl) : null;
      if (cached?.blob && (!indexedFile || cached.lastModified === indexedFile.lastModified) &&
          await window.esPdfValido(cached.blob)) {
        const objectUrl = URL.createObjectURL(cached.blob);
        return { view: objectUrl, download: objectUrl, objectUrl };
      }
    } catch (error) {
      console.error("No se pudo leer el PDF guardado en caché:", error);
    }
    if (cached?.blob && !await window.esPdfValido(cached.blob)) {
      try {
        await window.eliminarPdfCache(fileUrl);
        cached = null;
      } catch (error) {
        console.error("No se pudo eliminar un archivo inválido de la caché:", error);
      }
    }

    try {
      const response = await fetch(fileUrl, { cache: "no-cache" });
      if (!response.ok) throw new Error(`No se pudo abrir el PDF (HTTP ${response.status}).`);
      if (response.headers.get("Content-Type")?.split(";")[0] !== "application/pdf") {
        throw new Error("El archivo recibido no es un PDF.");
      }
      const blob = await response.blob();
      if (!await window.esPdfValido(blob)) throw new Error("El archivo recibido no contiene un PDF válido.");
      if (window.guardarPdfCache) {
        try {
          await window.guardarPdfCache(fileUrl, blob, indexedFile?.lastModified || "");
        } catch (error) {
          console.error("No se pudo guardar este PDF en la caché:", error);
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      return { view: objectUrl, download: objectUrl, objectUrl };
    } catch (error) {
      if (cached?.blob && await window.esPdfValido(cached.blob)) {
        console.warn("No se pudo actualizar el PDF; se abrirá la copia guardada en caché.", error);
        const objectUrl = URL.createObjectURL(cached.blob);
        return { view: objectUrl, download: objectUrl, objectUrl };
      }
      throw error;
    }
  }
  u = u.replace(/^(https?:)+\/\//, "https://");
  const id = (u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1];
  if (id && u.includes("drive.google.com"))
    return { view: `https://drive.google.com/file/d/${id}/preview`, download: `https://drive.google.com/uc?export=download&id=${id}` };
  return { view: u, download: u };
}

async function renderPdfsCarpeta() {
  const list = $("browserFolderList");
  const clearButton = $("browserFolderClear");
  if (!list || !window.obtenerPdfsCarpeta) return;
  const files = await window.obtenerPdfsCarpeta();
  const privateRecords = await window.obtenerCacheDatos("browser-folder-expedientes-v1");
  clearButton.hidden = !files.length && !Array.isArray(privateRecords?.value);
  list.innerHTML = files.length ? files.map((file, index) => `
    <li class="browser-file-row">
      <span class="browser-file-name" title="${esc(file.path)}">${esc(file.path)}</span>
      <span class="browser-file-actions">
        <button type="button" data-browser-view="${index}">Ver</button>
        <button type="button" data-browser-download="${index}">Descargar</button>
      </span>
    </li>`).join("") : `<li class="browser-file-empty">${privateRecords?.value?.length ? "La carpeta seleccionada no contiene PDF guardados." : "Aún no has seleccionado una carpeta."}</li>`;
  list.querySelectorAll("[data-browser-view]").forEach(button => {
    const file = files[Number(button.dataset.browserView)];
    button.onclick = () => abrirVisor(file.url, file.name);
  });
  list.querySelectorAll("[data-browser-download]").forEach(button => {
    const file = files[Number(button.dataset.browserDownload)];
    button.onclick = () => descargar(file.url, file.name);
  });
}

function inicializarCargaCarpeta() {
  const input = $("browserFolderInput");
  const selectButton = $("browserFolderButton");
  const resultsSelectButton = $("btnCargarCarpetaResultados");
  const clearButton = $("browserFolderClear");
  const status = $("browserFolderStatus");
  if (!input || !selectButton || !clearButton || !status) return;

  selectButton.onclick = () => input.click();
  if (resultsSelectButton) resultsSelectButton.onclick = () => input.click();
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    selectButton.disabled = true;
    status.classList.remove("err");
    try {
      status.textContent = "Esperando a que se complete la carga inicial...";
      await cargaInicialDatos;
      status.textContent = "Leyendo archivos en este navegador; no se están enviando a Internet...";
      const pdfResult = await window.importarPdfsCarpeta(files, progress => {
        status.textContent = `Guardando PDF ${progress.completed} de ${progress.total} en este navegador...`;
      });
      const dataFile = files.find(file => /(?:^|[\\/])data[\\/]expedientes\.json$/i.test(file.webkitRelativePath || file.name));
      let expedienteCount = 0;
      if (dataFile) {
        const data = JSON.parse(await dataFile.text());
        if (!Array.isArray(data) || data.some(expediente => !expediente || typeof expediente.codigo !== "string")) {
          throw new Error("data/expedientes.json no contiene una lista válida de expedientes.");
        }
        expedienteCount = await window.agregarExpedientesPrivados(data);
      }
      const failures = [
        pdfResult.invalid ? `${pdfResult.invalid} archivo(s) no eran PDF válidos y se omitieron` : "",
        pdfResult.failed > pdfResult.invalid ? `${pdfResult.failed - pdfResult.invalid} PDF no se pudieron guardar` : ""
      ].filter(Boolean).join("; ");
      const failureMessage = failures ? `; ${failures}` : "";
      if (expedienteCount) {
        status.textContent = `${pdfResult.cached} PDF disponibles en este navegador; ${expedienteCount} expediente(s) cargados${failureMessage}.`;
        mostrarResultados(DB_EXPS);
      } else {
        status.textContent = `${pdfResult.cached} PDF disponibles en este navegador${failureMessage}. No se encontró data/expedientes.json: selecciona la carpeta raíz del proyecto para mostrar el expediente.`;
        mostrarVista("busqueda");
      }
      await renderPdfsCarpeta();
    } catch (error) {
      console.error("No se pudieron cargar los archivos locales:", error);
      status.textContent = error.message || "No se pudieron cargar los archivos de la carpeta.";
      status.classList.add("err");
    } finally {
      selectButton.disabled = false;
      input.value = "";
    }
  };

  clearButton.onclick = async () => {
    clearButton.disabled = true;
    try {
      await window.olvidarDatosCarpeta();
      location.reload();
    } catch (error) {
      console.error("No se pudieron eliminar los archivos privados de este navegador:", error);
      status.textContent = error.message || "No se pudieron eliminar los archivos privados.";
      status.classList.add("err");
      clearButton.disabled = false;
    }
  };
  renderPdfsCarpeta().catch(error => {
    console.error("No se pudo leer la lista de documentos de este navegador:", error);
    status.textContent = "No se pudo leer la caché privada del navegador.";
    status.classList.add("err");
  });
}
async function abrirVisor(url, titulo) {
  try {
    const r = await resolverUrl(url);
    if (!r.view) return toast("Documento no disponible");
    if (visorObjectUrl) URL.revokeObjectURL(visorObjectUrl);
    visorObjectUrl = r.objectUrl || "";
    $("visor-nombre").textContent = titulo || "Documento";
    $("iframe-drive").src = r.view;
    $("visorExt").href = r.view;
    $("visorModal").hidden = false;
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error("No se pudo abrir el documento:", error);
    toast(error.message || "No se pudo abrir el documento.");
  }
}
let visorObjectUrl = "";
function cerrarVisor() {
  $("visorModal").hidden = true;
  $("iframe-drive").src = "";
  if (visorObjectUrl) URL.revokeObjectURL(visorObjectUrl);
  visorObjectUrl = "";
  document.body.style.overflow = "";
}
async function descargar(url, titulo) {
  try {
    const r = await resolverUrl(url);
    if (!r.view) return toast("Documento no disponible");
    toast(`Descargando copia: ${titulo}`);
    const a = document.createElement("a");
    a.href = r.download || r.view;
    a.download = (titulo || "documento").replace(/[\\/:*?"<>|]/g, "_") + ".pdf";
    a.rel = "noopener";
    document.body.append(a); a.click(); a.remove();
    if (r.objectUrl) setTimeout(() => URL.revokeObjectURL(r.objectUrl), 60000);
  } catch (error) {
    console.error("No se pudo descargar el documento:", error);
    toast(error.message || "No se pudo descargar el documento.");
  }
}
window.abrirVisorPdf = abrirVisor;   // compatibilidad
$("btnCerrarVisor").onclick = cerrarVisor;
$("visorModal").addEventListener("click", e => { if (e.target === $("visorModal")) cerrarVisor(); });

/* ===================== BOTONES CABECERA DETALLE ===================== */
$("btnImprimir").onclick = () => { toast("Preparando reporte para impresión"); setTimeout(() => window.print(), 400); };
$("btnResumenIA").onclick = () => { abrirIA(); responderIA("resumen", true); };
$("btnExaminar").onclick = () => {
  toast("Herramienta de análisis de caso iniciada. Cargando datos...");
  setTimeout(() => { abrirIA(); responderIA("examinar", true); }, 900);
};
$("btnReniec").onclick = abrirReniec;

/* ===================== ASISTENTE IA ===================== */
const KB = [
  [["paz letrado", " jp "], "El Juzgado de Paz Letrado (JP) es de primera instancia y conoce procesos de alimentos, menor cuantía y civiles de cuantía reducida."],
  [["especializado", " jr "], "El Juzgado Especializado (JR) conoce procesos de mayor complejidad y resuelve apelaciones de los Juzgados de Paz Letrados."],
  [["trabajo", "laboral"], "El Juzgado de Trabajo tramita demandas laborales bajo la Nueva Ley Procesal del Trabajo (Ley 29497), como reposición y beneficios sociales."],
  [["sala superior", " sp ", "apelacion"], "La Sala Superior (SP) es segunda instancia: revisa por apelación las decisiones de los Juzgados Especializados y de Trabajo."],
  [["codigo", "formato"], "El código tiene 7 partes: Secuencia(5)-Año(4)-Órgano(1)-Distrito(4)-Instancia(2)-Especialidad(2)-Correlativo(2). Ej: 00000-0000-0-0000-JR-CI-00."],
  [["redam", "moroso"], "Deudores alimentarios morosos: REDAM (Ley 28970)."],
  [["penal", "957"], "El proceso penal se rige por el Nuevo Código Procesal Penal (D. Leg. 957), modelo acusatorio."],
  [["29733", "datos personales"], "La Ley N° 29733 protege los datos personales; por ello se solicita el nombre de la parte para acceder al expediente."]
];

function abrirIA() {
  document.body.classList.add("chat-open");
  $("iaModal").hidden = false;
  if (!$("iaChat").children.length)
    msgIA("Hola, soy PIBbLE. ¿Qué deseas saber sobre este expediente o proceso judicial?\nPuedes preguntar por: estado, partes, sentencia, última actuación, juez, avance, cronología o temas generales.");
  setTimeout(() => $("iaInput").focus(), 50);
}
function cerrarIA() {
  $("iaModal").hidden = true;
  document.body.classList.remove("chat-open");
}
$("aiAssistantBtn").addEventListener("click", e => {
  e.preventDefault();
  abrirIA();
});
$("btnCerrarIA").onclick = cerrarIA;
$("iaModal").addEventListener("click", e => { if (e.target === $("iaModal")) cerrarIA(); });

function msgIA(t, user) {
  const d = document.createElement("div");
  d.className = "im" + (user ? " u" : "");
  const av = user
    ? `<div class="av"><i class="fa-solid fa-user"></i></div>`
    : `<div class="av"><img src="img/pibble.svg" alt="PIBbLE"></div>`;
  d.innerHTML = user ? `<div class="bb"></div>${av}` : `${av}<div class="bb"></div>`;
  d.querySelector(".bb").textContent = t;
  $("iaChat").append(d);
  $("iaChat").scrollTop = $("iaChat").scrollHeight;
  return d;
}

function generarRespuesta(q) {
  const n = " " + norm(q).toLowerCase() + " ", x = expActual;
  const respuestaNumerica = calcularOperacion(q);
  if (respuestaNumerica !== null) return `El resultado es ${respuestaNumerica}.`;
  if (/hola|buenas|buenos dias|buenas tardes/.test(n)) {
    return "¡Hola! Soy PIBbLE. Puedo ayudarte con cálculos, preguntas generales y consultas sobre el expediente abierto.";
  }
  if (/gracias|muchas gracias/.test(n)) return "¡De nada! Estoy aquí para ayudarte.";
  if (/quien eres|que puedes hacer|que haces/.test(n)) {
    return "Soy PIBbLE, el asistente virtual del expediente. Puedo resolver operaciones aritméticas, responder preguntas básicas y ayudarte a consultar el estado, las partes, las actuaciones y la cronología del expediente.";
  }
  if (/que hora|hora es/.test(n)) return `La hora local es ${new Date().toLocaleTimeString("es-PE")}.`;
  if (/que fecha|fecha es|dia es hoy/.test(n)) return `Hoy es ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}.`;
  if (x) {
    const rp = x.reporte || {}, pr = x.progreso || {}, acts = x.actuaciones || [];
    const partes = (x.partes || []).map(p => `• ${p.rol}: ${[p.apellidoPaterno, p.apellidoMaterno, p.nombres].filter(Boolean).join(" ")}`).join("\n");
    const et = etapasMapa(x), cur = et.find(e => e.estado === "current"), next = et.find(e => e.estado === "pending");
    if (n.includes("resumen")) {
      const a = actuacionClave(x);
      return `RESUMEN INTELIGENTE — ${x.codigo}\n\n` +
        `• Proceso: ${rp.proceso}\n• Materia: ${rp.materia}\n• Órgano: ${rp.organoJurisdiccional}\n• Estado: ${rp.estado} (${pr.porcentaje || 0}% de avance)\n` +
        `• Etapa actual: ${cur ? cur.nombre : rp.etapaProcesal}\n` +
        (a ? `• Resolución clave (${a.fecha}): ${a.sumilla}\n` : "") +
        `\n${pr.mensaje || ""}`;
    }
    if (n.includes("examinar")) {
      const ced = acts.reduce((s, a) => s + (a.cedulas || []).length, 0);
      const docs = acts.filter(a => a.pdfUrl || (a.docs && a.docs.length)).length;
      return `ANÁLISIS DEL CASO\n\n• Actuaciones registradas: ${acts.length}\n• Documentos digitalizados: ${docs}\n• Cédulas de notificación: ${ced}\n` +
        `• Sujetos procesales: ${(x.partes || []).length}\n• Avance: ${pr.porcentaje || 0}%\n` +
        `• Etapa actual: ${cur ? cur.nombre : "—"}\n• Próxima etapa probable: ${next ? next.nombre : "Proceso en fase final"}\n\n` +
        `Última actuación: ${acts[0] ? `${acts[0].fecha} — ${acts[0].acto}` : "—"}`;
    }
    if (/estado|situacion/.test(n)) return `Estado actual: ${rp.estado}. Etapa procesal: ${rp.etapaProcesal}. ${pr.mensaje || ""}`;
    if (/parte|demandad|demandante|sujeto/.test(n)) return `Sujetos procesales:\n${partes || "Sin registro."}`;
    if (/sentencia|fallo|resolucion/.test(n)) { const a = actuacionClave(x); return a ? `${a.acto} (${a.fecha}): ${a.sumilla}` : "Aún no se registra sentencia."; }
    if (/ultima|reciente|actuacion/.test(n)) return acts[0] ? `Última actuación (${acts[0].fecha}): ${acts[0].acto}.\n${acts[0].sumilla}` : "Sin actuaciones.";
    if (/juez|jueza|magistrad/.test(n)) return `Juez(a): ${rp.juez}. Especialista legal: ${rp.especialistaLegal}.`;
    if (/avance|progreso|porcentaje|etapa/.test(n)) return `El proceso tiene un avance del ${pr.porcentaje || 0}%. Etapa actual: ${cur ? cur.nombre : rp.etapaProcesal}.` + (next ? ` Siguiente etapa probable: ${next.nombre}.` : "");
    if (/proximo|siguiente/.test(n)) return next ? `Próxima etapa probable: ${next.nombre}.` : "El proceso se encuentra en su fase final.";
    if (/cronolog|linea de tiempo|hito/.test(n)) return (pr.hitos || []).map(h => `• ${h.fecha}: ${h.descripcion}`).join("\n") || "Sin hitos registrados.";
    if (/materia|delito/.test(n)) return `Materia: ${rp.materia}. Sumilla: ${rp.sumilla}.`;
  }
  const hit = KB.find(([ks]) => ks.some(k => n.includes(k)));
  if (hit) return hit[1] + "\n\n(Información referencial)";
  if (/hola|buenas/.test(n)) return "Hola, soy tu asistente IA especializado en consultas judiciales. ¿En qué puedo ayudarte?";
  return x ? "Puedo ayudarte con: estado, partes, sentencia, última actuación, juez, avance, próximo paso o cronología del expediente."
           : "Puedo resolver operaciones y responder preguntas básicas. Para consultar datos de un proceso, primero busca y abre un expediente.";
}

function calcularOperacion(pregunta) {
  const normalizada = pregunta.toLowerCase()
    .replace(/multiplicado\s+por|por/g, "*")
    .replace(/dividido\s+entre|dividido\s+por|entre/g, "/")
    .replace(/\b(?:suma|sumar)\b/g, "")
    .replace(/(\d+(?:\.\d+)?)\s+y\s+(\d+(?:\.\d+)?)/g, "$1+$2")
    .replace(/\bm[aá]s\b/g, "+")
    .replace(/\bmenos\b/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, ".");
  const expresiones = normalizada.match(/(?:\d+(?:\.\d+)?|[()+*/%\-])(?:\s*(?:\d+(?:\.\d+)?|[()+*/%\-]))+/g) || [];
  const expresion = expresiones.find(item => /\d/.test(item) && /[+*/%\-]/.test(item) && /^[\d\s.+*/()%\-]+$/.test(item));
  if (!expresion) return null;

  const tokens = expresion.match(/\d+(?:\.\d+)?|[()+*/%\-]/g) || [];
  let posicion = 0;
  function primario() {
    const token = tokens[posicion++];
    if (token === "+") return primario();
    if (token === "-") return -primario();
    if (token === "(") {
      const resultado = suma();
      if (tokens[posicion++] !== ")") throw new Error("Paréntesis incompletos");
      return resultado;
    }
    if (!token || !/^\d/.test(token)) throw new Error("Operación inválida");
    return Number(token);
  }
  function producto() {
    let resultado = primario();
    while (["*", "/", "%"].includes(tokens[posicion])) {
      const operador = tokens[posicion++];
      const valor = primario();
      if ((operador === "/" || operador === "%") && valor === 0) throw new Error("No se puede dividir entre cero");
      if (operador === "*") resultado *= valor;
      if (operador === "/") resultado /= valor;
      if (operador === "%") resultado %= valor;
    }
    return resultado;
  }
  function suma() {
    let resultado = producto();
    while (tokens[posicion] === "+" || tokens[posicion] === "-") {
      const operador = tokens[posicion++];
      const valor = producto();
      resultado = operador === "+" ? resultado + valor : resultado - valor;
    }
    return resultado;
  }
  try {
    const resultado = suma();
    if (posicion !== tokens.length || !Number.isFinite(resultado)) return null;
    return Number.isInteger(resultado) ? String(resultado) : String(Number(resultado.toFixed(8)));
  } catch {
    return null;
  }
}

const historialChatIA = [];

async function consultarChatGPT(pregunta) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
    return generarRespuesta(pregunta);
  }

  const contextoExpediente = expActual ? JSON.stringify({
    codigo: expActual.codigo,
    reporte: expActual.reporte,
    progreso: expActual.progreso,
    partes: expActual.partes,
    actuaciones: expActual.actuaciones
  }) : "No hay expediente seleccionado.";

  const respuesta = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: pregunta,
      history: historialChatIA.slice(-10),
      context: contextoExpediente,
      language: document.documentElement.lang || "es"
    })
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos.error || `Error HTTP ${respuesta.status}`);
  }

  historialChatIA.push({ role: "user", content: pregunta });
  historialChatIA.push({ role: "assistant", content: datos.reply });
  if (historialChatIA.length > 20) historialChatIA.splice(0, historialChatIA.length - 20);
  return datos.reply;
}

function responderIA(q, silencioso) {
  if (!silencioso) msgIA(q, true);
  const t = msgIA("Escribiendo...");
  t.querySelector(".bb").classList.add("typing");
  consultarChatGPT(q).then(respuesta => {
    t.remove();
    msgIA(respuesta);
  }).catch(error => {
    t.remove();
    console.warn("La API del chatbot no está disponible; se usa el asistente local:", error);
    msgIA(generarRespuesta(q));
  });
}
$("iaForm").onsubmit = e => {
  e.preventDefault();
  const q = $("iaInput").value.trim(); if (!q) return;
  $("iaInput").value = "";
  responderIA(q);
};

/* ===================== RENIEC (simulado) ===================== */
function abrirReniec() {
  $("reniecModal").hidden = false;
  $("reniecResults").hidden = true; $("reniecError").hidden = true;
  setTimeout(() => $("dniInput").focus(), 50);
}
function cerrarReniec() { $("reniecModal").hidden = true; $("dniInput").value = ""; }
$("btnCerrarReniec").onclick = cerrarReniec;
$("reniecModal").addEventListener("click", e => { if (e.target === $("reniecModal")) cerrarReniec(); });

function datosDNI(dni) {
  const s = parseInt(dni, 10), g = (a, o = 0) => a[Math.abs((s + o) % a.length)];
  const nombres = ["Juan", "María", "Carlos", "Patricia", "Roberto", "Ana", "Luis", "Rosa", "Miguel", "Carmen", "Pedro", "Laura", "Diego", "Elena", "José", "Dionicio"];
  const ap1 = ["García", "López", "Martínez", "Rodríguez", "Pérez", "Sánchez", "Torres", "Flores", "Quispe", "Ccatcca", "Mamani", "Condori", "Puma", "Fernández", "Vega", "Choque"];
  const ap2 = ["Rojas", "Castro", "Ortiz", "Díaz", "Herrera", "Gómez", "Reyes", "Morales", "Ramos", "Campos", "Choque", "Ticona", "Avendaño", "Mendoza", "Lara"];
  const dep = ["Puno", "Arequipa", "Tacna", "Moquegua", "Cusco", "Apurímac", "Ayacucho"];
  const prov = ["Puno", "San Román", "Huancané", "Azángaro", "Carabaya", "Chucuito", "El Collao", "Yunguyo"];
  const dist = ["Puno", "Juliaca", "Huancané", "Azángaro", "Macusani", "Juli", "Ilave", "Yunguyo"];
  const calles = ["Av. Los Andes", "Jr. Principal", "Calle Central", "Av. Comercio", "Jr. Minería", "Pasaje Andino", "Av. Arequipa", "Calle Lima"];
  const nums = [123, 456, 789, 234, 567, 890, 345, 678];
  const sexo = g(["Masculino", "Femenino"], 4);
  const civ = g(["Soltero(a)", "Casado(a)", "Divorciado(a)", "Viudo(a)", "Conviviente"], 8);
  const p = v => String(v).padStart(2, "0");
  const nac = `${p(1 + Math.abs(s + 200) % 28)}/${p(1 + Math.abs(s + 100) % 12)}/${1960 + Math.abs(s) % 45}`;
  const d = g(dep, 5), pr = g(prov, 6), di = g(dist, 7), dir = `${g(calles, 9)} ${g(nums, 10)}`;
  return [
    ["Nombres", g(nombres, 1), "full"], ["Apellidos", `${g(ap1, 2)} ${g(ap2, 3)}`, "full"],
    ["DNI", dni], ["Sexo", sexo], ["Nacimiento", nac, "full"], ["Est. Civil", civ, "full"],
    ["Depto", d, "blue"], ["Provincia", pr, "blue"], ["Distrito", di, "blue"], ["Dirección", dir, "blue"],
    ["Dir. Completa", `${dir}, ${di}, ${pr} - ${d} ${21000 + Math.abs(s % 1000)}`, "full yel"]
  ];
}

function crearFotoFicticia(dni, sexo) {
  const tonoPiel = ["#f2c7a5", "#d9a56c", "#9c6847", "#6f4a32"][parseInt(dni, 10) % 4];
  const cabello = ["#24120e", "#5a2d1b", "#1f2937", "#8b5a35"][parseInt(dni.slice(-2), 10) % 4];
  const fondo = sexo === "Femenino" ? "#f9a8d4" : "#93c5fd";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="184" height="224" viewBox="0 0 184 224">
    <rect width="184" height="224" fill="${fondo}"/>
    <rect y="164" width="184" height="60" fill="#7f1d1d"/>
    <ellipse cx="92" cy="94" rx="48" ry="58" fill="${tonoPiel}"/>
    <path d="M44 86c2-44 25-66 49-66 31 0 50 21 48 69-13-11-22-25-25-40-17 18-40 29-72 37z" fill="${cabello}"/>
    <circle cx="75" cy="96" r="4" fill="#312e2b"/><circle cx="109" cy="96" r="4" fill="#312e2b"/>
    <path d="M80 122c8 7 18 7 26 0" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>
    <rect x="36" y="176" width="112" height="48" rx="18" fill="#fff"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function buscarDNI() {
  const dni = $("dniInput").value.trim();
  if (!/^\d{8}$/.test(dni)) {
    $("reniecResults").hidden = true; $("reniecError").hidden = false;
    return toast("Ingresa un DNI válido (8 dígitos)");
  }
  toast("Buscando en RENIEC...");
  setTimeout(() => {
    const datos = datosDNI(dni);
    const sexo = datos.find(([clave]) => clave === "Sexo")?.[1] || "Masculino";
    $("reniecPhoto").src = crearFotoFicticia(dni, sexo);
    $("reniecPhoto").alt = "Fotografía ficticia generada para simulación académica";
    $("reniecGrid").innerHTML = datos.map(([k, v, c]) => `<div class="rf ${c || ""}"><p>${k}</p><b>${esc(v)}</b></div>`).join("");
    $("reniecError").hidden = true; $("reniecResults").hidden = false;
    toast("Datos ficticios encontrados (simulación)");
  }, 700);
}
$("btnBuscarDni").onclick = buscarDNI;
$("dniInput").addEventListener("keydown", e => { if (e.key === "Enter") buscarDNI(); });

/* ===================== ESC global ===================== */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("visorModal").hidden) cerrarVisor();
  else if (!$("reniecModal").hidden) cerrarReniec();
  else if (!$("iaModal").hidden) cerrarIA();
  else if (modalAdv && !modalAdv.classList.contains("adv-hidden")) modalAdv.classList.add("adv-hidden");
});

/* ===================== INICIO ===================== */
inicializarCargaCarpeta();
cargaInicialDatos = cargarDB();
(() => {
  const s = sessionStorage.getItem("sice_sesion"), db = users();
  if (s && db[s]) entrar(s, db[s].nombre);
})();
