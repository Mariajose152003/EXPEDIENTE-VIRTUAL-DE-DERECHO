/* ================================================================
   SICE - app.js
   Base de datos: data/expedientes.json (GitHub Pages friendly)
================================================================ */

/* ===== CONSTANTES LOCALES ===== */
const DIST   = { PUNO:"2101", LIMA:"1801", AREQUIPA:"0401", CUSCO:"0701" };
const INST   = {
  "JUZGADO DE TRABAJO": "JUZGADO DE TRABAJO",
  "JUZGADO ESPECIALIZADO": "JUZGADO ESPECIALIZADO",
  "JUZGADO PENAL": "JUZGADO PENAL",
  "JUZGADO CIVIL": "JUZGADO CIVIL",
  "JUZGADO DE PAZ LETRADO": "JUZGADO DE PAZ LETRADO",
  "SALA SUPERIOR": "SALA SUPERIOR"
};
const ESP    = { FC:"FAMILIA CIVIL", CI:"CIVIL", PE:"PENAL", LA:"LABORAL", CO:"COMERCIAL" };
const ESTADOS = ["EN TRAMITE","EN EJECUCION","CONCLUIDO","ARCHIVADO","EN EJECUCION / RES JUDICATA"];
const ADMIN_USER = "admin";

/* ===== UTIL ===== */
const $ = id => document.getElementById(id);
const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();
const fill = (sel, obj, ph) => {
  sel.innerHTML = `<option value="">${ph}</option>` +
    Object.entries(obj).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
};
const cod = x => [x.sec,x.anio,x.org,x.dist,x.inst,x.esp,x.corr].join("-");

/* ===== BASE DE DATOS INTEGRADA ===== */
const BASE_EXPS = [];

let DB_EXPS = [...BASE_EXPS];

async function cargarDB() {
  try {
    const r = await fetch('data/expedientes.json?t=' + Date.now());
    if (r.ok) {
      const fetched = await r.json();
      fetched.forEach(x => {
        const idx = DB_EXPS.findIndex(e => e.codigo === x.codigo);
        if (idx !== -1) DB_EXPS[idx] = x;
        else DB_EXPS.push(x);
      });
    }
  } catch(_) {}
  const local = JSON.parse(localStorage.getItem('sice_exps_v2') || '[]');
  local.forEach(x => {
    const isBase = BASE_EXPS.some(b => b.codigo === x.codigo);
    if (!isBase) {
      const idx = DB_EXPS.findIndex(e => e.codigo === x.codigo);
      if (idx !== -1) DB_EXPS[idx] = x;
      else DB_EXPS.push(x);
    }
  });
}

function getCustomExps() { return JSON.parse(localStorage.getItem("sice_exps_v2") || "[]"); }
function saveCustomExps(arr) { localStorage.setItem("sice_exps_v2", JSON.stringify(arr)); }
