/* ================================================================
   ui.js — Interfaz "Consulta de Expedientes Judiciales" (diseño PJ)
   Depende de app.js (DB_EXPS, DIST, INST, ESP, $, norm, fill, cargarDB)
================================================================ */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const cap1 = s => { s = String(s||"").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

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

$("btnModo").onclick = () => {
  registro = !registro;
  $("tituloLogin").textContent = registro ? "Crear cuenta" : "Iniciar Sesión";
  $("btnLogin").innerHTML = registro
    ? '<span>REGISTRARME</span><i class="fa-solid fa-user-plus"></i>'
    : '<span>INGRESAR AL SISTEMA</span><i class="fa-solid fa-arrow-right-to-bracket"></i>';
  $("btnModo").textContent = registro ? "Ya tengo cuenta" : "¿No tienes cuenta? Regístrate";
  $("lblNombre").hidden = !registro;
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
  $("vistaLogin").hidden = true;
  $("vistaApp").hidden = false;
  $("aiAssistantBtn").hidden = false;
  $("usuario").textContent = nombre;
  $("btnAdmin").hidden = !(usuario === ADMIN_USER || usuario === "admin");
  finSesion = Date.now() + 15 * 60000;
  clearInterval(timer); timer = setInterval(reloj, 1000); reloj();
  generateCaptcha();
  mostrarVista("busqueda");
}
function salir() { sessionStorage.removeItem("sice_sesion"); location.reload(); }
$("btnSalir").onclick = salir;

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

let modo = "filtros";
document.querySelectorAll(".stab").forEach(t => t.onclick = () => {
  modo = t.dataset.t;
  document.querySelectorAll(".stab").forEach(x => x.classList.toggle("on", x === t));
  $("tab-filtros").hidden = modo !== "filtros";
  $("tab-codigo").hidden = modo !== "codigo";
  $("busqMsg").textContent = "";
});

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
      // 1. Número de Expediente (acepta 00957 o 957)
      const matchNum = x.sec === num || parseInt(x.sec, 10) === parseInt(numVal, 10);
      if (!matchNum) return false;

      // 2. Distrito Judicial (Puno cubre 2101 y 2111)
      if (d) {
        if (d === "PUNO") {
          if (x.dist !== "2101" && x.dist !== "2111" && !norm(x.reporte?.distritoJudicial).includes("PUNO")) return false;
        } else if (x.dist !== DIST[d] && !norm(x.reporte?.distritoJudicial).includes(norm(d))) {
          return false;
        }
      }

      // 3. Instancia
      if (ins) {
        const insNorm = norm(ins);
        const xInst = norm(x.inst);
        const xOrg = norm(x.reporte?.organoJurisdiccional || "");
        let mInst = false;
        if (xInst === insNorm || xOrg.includes(insNorm)) mInst = true;
        else if (insNorm.includes("TRABAJO") && (xOrg.includes("TRABAJO") || x.esp === "LA")) mInst = true;
        else if (insNorm.includes("PENAL") && (xOrg.includes("PENAL") || x.esp === "PE")) mInst = true;
        else if (insNorm.includes("CIVIL") && (xOrg.includes("CIVIL") || x.esp === "CI")) mInst = true;
        else if (insNorm.includes("PAZ") && (x.inst === "JP" || xOrg.includes("PAZ"))) mInst = true;
        else if (insNorm.includes("SUPERIOR") && (x.inst === "SP" || xOrg.includes("SUPERIOR"))) mInst = true;
        else if (insNorm.includes("ESPECIALIZADO") && (x.inst === "JR" || xOrg.includes("ESPECIALIZADO"))) mInst = true;
        if (!mInst) return false;
      }

      // 4. Especialidad
      if (es) {
        const esNorm = norm(es);
        const xEsp = norm(x.esp);
        const xEspNom = norm(x.reporte?.especialidad || "");
        let mEsp = false;
        if (xEsp === esNorm || xEspNom === esNorm) mEsp = true;
        else if (esNorm === "LABORAL" && (x.esp === "LA" || xEspNom.includes("LABORAL"))) mEsp = true;
        else if (esNorm === "CIVIL" && (x.esp === "CI" || xEspNom.includes("CIVIL"))) mEsp = true;
        else if (esNorm === "PENAL" && (x.esp === "PE" || xEspNom.includes("PENAL"))) mEsp = true;
        else if (esNorm.includes("FAMILIA") && (x.esp === "FC" || xEspNom.includes("FAMILIA"))) mEsp = true;
        else if (esNorm === "COMERCIAL" && (x.esp === "CO" || xEspNom.includes("COMERCIAL"))) mEsp = true;
        if (!mEsp) return false;
      }

      // 5. Año
      if (an && x.anio !== an) return false;
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
    const encoded = encodeURI(cleanPath);
    return { view: encoded, download: encoded };
  }
  u = u.replace(/^(https?:)+\/\//, "https://");
  const id = (u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1];
  if (id && u.includes("drive.google.com"))
    return { view: `https://drive.google.com/file/d/${id}/preview`, download: `https://drive.google.com/uc?export=download&id=${id}` };
  return { view: u, download: u };
}
async function abrirVisor(url, titulo) {
  const r = await resolverUrl(url);
  if (!r.view) return toast("Documento no disponible");
  $("visor-nombre").textContent = titulo || "Documento";
  $("iframe-drive").src = r.view;
  $("visorExt").href = r.view;
  $("visorModal").hidden = false;
  document.body.style.overflow = "hidden";
}
function cerrarVisor() {
  $("visorModal").hidden = true;
  $("iframe-drive").src = "";
  document.body.style.overflow = "";
}
async function descargar(url, titulo) {
  const r = await resolverUrl(url);
  toast(`Descargando copia: ${titulo}`);
  const a = document.createElement("a");
  a.href = r.download || r.view;
  a.download = (titulo || "documento").replace(/[\\/:*?"<>|]/g, "_") + ".pdf";
  a.target = "_blank"; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
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
  $("iaModal").hidden = false;
  if (!$("iaChat").children.length)
    msgIA("Hola, soy tu asistente IA. ¿Qué deseas saber sobre este expediente o proceso judicial?\nPuedes preguntar por: estado, partes, sentencia, última actuación, juez, avance o cronología.");
  setTimeout(() => $("iaInput").focus(), 50);
}
function cerrarIA() { $("iaModal").hidden = true; }
$("aiAssistantBtn").onclick = abrirIA;
$("btnCerrarIA").onclick = cerrarIA;
$("iaModal").addEventListener("click", e => { if (e.target === $("iaModal")) cerrarIA(); });

function msgIA(t, user) {
  const d = document.createElement("div");
  d.className = "im" + (user ? " u" : "");
  const av = `<div class="av"><i class="fa-solid ${user ? "fa-user" : "fa-robot"}"></i></div>`;
  d.innerHTML = user ? `<div class="bb"></div>${av}` : `${av}<div class="bb"></div>`;
  d.querySelector(".bb").textContent = t;
  $("iaChat").append(d);
  $("iaChat").scrollTop = $("iaChat").scrollHeight;
  return d;
}

function generarRespuesta(q) {
  const n = " " + norm(q).toLowerCase() + " ", x = expActual;
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
           : "Primero consulta un expediente para darte información específica. También puedo explicarte el formato del código, tipos de juzgado o leyes relacionadas.";
}
function responderIA(q, silencioso) {
  if (!silencioso) msgIA(q, true);
  const t = msgIA("Escribiendo...");
  t.querySelector(".bb").classList.add("typing");
  setTimeout(() => { t.remove(); msgIA(generarRespuesta(q)); }, 600);
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
function buscarDNI() {
  const dni = $("dniInput").value.trim();
  if (!/^\d{8}$/.test(dni)) {
    $("reniecResults").hidden = true; $("reniecError").hidden = false;
    return toast("Ingresa un DNI válido (8 dígitos)");
  }
  toast("Buscando en RENIEC...");
  setTimeout(() => {
    $("reniecGrid").innerHTML = datosDNI(dni).map(([k, v, c]) => `<div class="rf ${c || ""}"><p>${k}</p><b>${esc(v)}</b></div>`).join("");
    $("reniecError").hidden = true; $("reniecResults").hidden = false;
    toast("Datos encontrados (simulación)");
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
cargarDB();
(() => {
  const s = sessionStorage.getItem("sice_sesion"), db = users();
  if (s && db[s]) entrar(s, db[s].nombre);
})();
