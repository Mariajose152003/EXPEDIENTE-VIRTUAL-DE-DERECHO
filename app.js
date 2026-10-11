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
// Datos base siempre disponibles (funciona sin servidor)
const BASE_EXPS = [];

let DB_EXPS = [...BASE_EXPS];

const PDF_CACHE_KEY = "pdf-index-v1";
const EXPEDIENTES_CACHE_KEY = "expedientes-v1";
const BROWSER_EXPEDIENTES_CACHE_KEY = "browser-folder-expedientes-v1";
let PDF_INDEX_FILES = [];

function esServidorLocal() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

function normalizarUrlPdf(url) {
  try {
    return decodeURIComponent(String(url || "").replace(/^\.\//, "").replace(/^\//, "")).replace(/\\/g, "/").toLocaleLowerCase();
  } catch (error) {
    console.warn("La URL de un PDF tiene una codificación inválida:", url, error);
    return String(url || "").replace(/^\.\//, "").replace(/^\//, "").replace(/\\/g, "/").toLocaleLowerCase();
  }
}

function esPdfLocal(url) {
  return /^(?:\.\/|\/)?expedientes\//i.test(String(url || ""));
}

function agregarIndicePdf(expedientes, archivos) {
  if (!archivos.length) return 0;

  const rutasDisponibles = new Set(archivos.map(archivo => normalizarUrlPdf(archivo.url)));

  expedientes.forEach(expediente => {
    if (esPdfLocal(expediente.expedienteCompletoUrl) &&
        !rutasDisponibles.has(normalizarUrlPdf(expediente.expedienteCompletoUrl))) {
      delete expediente.expedienteCompletoUrl;
    }
    const actuaciones = expediente.actuaciones || [];
    actuaciones.forEach(actuacion => {
      if (esPdfLocal(actuacion.pdfUrl) && !rutasDisponibles.has(normalizarUrlPdf(actuacion.pdfUrl))) {
        delete actuacion.pdfUrl;
      }
      if (Array.isArray(actuacion.docs)) {
        actuacion.docs = actuacion.docs.filter(documento =>
          !esPdfLocal(documento.url) || rutasDisponibles.has(normalizarUrlPdf(documento.url))
        );
        if (!actuacion.docs.length) delete actuacion.docs;
      }
      if (Array.isArray(actuacion.cedulas)) {
        actuacion.cedulas.forEach(cedula => {
          if (esPdfLocal(cedula.pdfUrl) && !rutasDisponibles.has(normalizarUrlPdf(cedula.pdfUrl))) {
            delete cedula.pdfUrl;
          }
        });
      }
    });
    if (!expediente.expedienteCompletoUrl && archivos.length) {
      expediente.expedienteCompletoUrl = archivos[0].url;
    }
  });

  const asignables = expedientes.length === 1 ? expedientes : [];
  const usados = new Set();
  expedientes.forEach(expediente => {
    if (esPdfLocal(expediente.expedienteCompletoUrl)) usados.add(normalizarUrlPdf(expediente.expedienteCompletoUrl));
    (expediente.actuaciones || []).forEach(actuacion => {
      if (esPdfLocal(actuacion.pdfUrl)) usados.add(normalizarUrlPdf(actuacion.pdfUrl));
      (actuacion.docs || []).forEach(documento => {
        if (esPdfLocal(documento.url)) usados.add(normalizarUrlPdf(documento.url));
      });
      (actuacion.cedulas || []).forEach(cedula => {
        if (esPdfLocal(cedula.pdfUrl)) usados.add(normalizarUrlPdf(cedula.pdfUrl));
      });
    });
  });

  const sinAsignar = archivos.filter(archivo => !usados.has(normalizarUrlPdf(archivo.url)));
  if (asignables.length) {
    const expediente = asignables[0];
    const siguienteNumero = Math.max(0, ...(expediente.actuaciones || []).map(actuacion => Number(actuacion.numero) || 0)) + 1;
    sinAsignar.forEach((archivo, index) => {
      expediente.actuaciones.push({
        numero: siguienteNumero + index,
        fecha: "",
        acto: archivo.name,
        sumilla: "Documento PDF detectado automáticamente en la carpeta local de expedientes.",
        responsable: "Archivo local",
        pdfUrl: archivo.url
      });
    });
  }

  return sinAsignar.length && !asignables.length ? sinAsignar.length : 0;
}

function fusionarExpedientes(...listas) {
  const porCodigo = new Map();
  listas.flat().forEach(expediente => {
    if (expediente && typeof expediente.codigo === "string" && expediente.codigo.trim()) {
      porCodigo.set(expediente.codigo, expediente);
    }
  });
  return Array.from(porCodigo.values());
}

async function fusionarExpedientesPrivados(expedientes) {
  if (!Array.isArray(expedientes) || expedientes.some(expediente =>
    !expediente || typeof expediente.codigo !== "string"
  )) {
    throw new Error("Los datos privados deben ser una lista válida de expedientes con código.");
  }

  const browserFiles = window.obtenerPdfsCarpeta ? await window.obtenerPdfsCarpeta() : [];
  const rutasIncluidas = new Set();
  PDF_INDEX_FILES = [...PDF_INDEX_FILES, ...browserFiles].filter(archivo => {
    const ruta = normalizarUrlPdf(archivo.url);
    if (rutasIncluidas.has(ruta)) return false;
    rutasIncluidas.add(ruta);
    return true;
  });
  DB_EXPS = fusionarExpedientes(DB_EXPS, expedientes);
  const sinAsignar = agregarIndicePdf(DB_EXPS, PDF_INDEX_FILES);
  actualizarEstadoDatos(`${DB_EXPS.length} expediente(s); ${PDF_INDEX_FILES.length} PDF disponibles en este navegador${sinAsignar ? `; ${sinAsignar} PDF sin expediente asignado` : ""}`);
  return expedientes.length;
}

function actualizarEstadoDatos(mensaje, error = false) {
  const estado = $("dbStatus");
  if (!estado) return;
  estado.textContent = mensaje;
  estado.classList.toggle("err", error);
}

async function cargarDB() {
  let expedientesRemotos = null;
  let fuenteExpedientes = "datos integrados";
  let errorCarga = null;

  try {
    const respuesta = await fetch("data/expedientes.json", { cache: "no-cache" });
    if (!respuesta.ok) throw new Error(`No se pudo cargar data/expedientes.json (HTTP ${respuesta.status}).`);
    const datos = await respuesta.json();
    if (!Array.isArray(datos) || datos.some(expediente => !expediente || typeof expediente.codigo !== "string")) {
      throw new Error("El archivo de expedientes debe contener una lista válida de expedientes con código.");
    }
    expedientesRemotos = datos;
    fuenteExpedientes = "servidor";
    if (window.guardarCacheDatos) {
      try {
        await window.guardarCacheDatos(EXPEDIENTES_CACHE_KEY, datos);
      } catch (error) {
        console.error("No se pudo actualizar la caché local de expedientes:", error);
      }
    }
  } catch (error) {
    errorCarga = error;
    console.warn("No se pudieron actualizar los expedientes desde el servidor:", error);
    if (window.obtenerCacheDatos) {
      try {
        const cache = await window.obtenerCacheDatos(EXPEDIENTES_CACHE_KEY);
        if (Array.isArray(cache?.value)) {
          expedientesRemotos = cache.value;
          fuenteExpedientes = "caché local";
        }
      } catch (cacheError) {
        console.error("No se pudo leer la caché local de expedientes:", cacheError);
      }
    }
  }

  let locales = [];
  try {
    const guardados = JSON.parse(localStorage.getItem("sice_exps_v2") || "[]");
    if (Array.isArray(guardados)) locales = guardados;
    else throw new Error("Los expedientes del navegador no tienen un formato de lista válido.");
  } catch (error) {
    console.error("No se pudieron leer los expedientes guardados en este navegador:", error);
    actualizarEstadoDatos("No se pudieron leer algunos expedientes guardados en este navegador.", true);
  }
  let privados = [];
  if (window.obtenerCacheDatos) {
    try {
      const cache = await window.obtenerCacheDatos(BROWSER_EXPEDIENTES_CACHE_KEY);
      if (Array.isArray(cache?.value)) privados = cache.value;
    } catch (error) {
      console.error("No se pudieron leer los expedientes privados de este navegador:", error);
    }
  }
  DB_EXPS = fusionarExpedientes(JSON.parse(JSON.stringify(BASE_EXPS)), expedientesRemotos || [], locales, privados);

  let archivos = [];
  let fuenteIndice = "";
  let errorIndice = null;
  if (esServidorLocal()) {
    try {
      const respuesta = await fetch("/api/pdf-index", { cache: "no-cache" });
      if (!respuesta.ok) throw new Error(`No se pudo leer el índice de PDF local (HTTP ${respuesta.status}).`);
      const indice = await respuesta.json();
      if (!Array.isArray(indice.files) || indice.files.some(archivo =>
        !archivo || typeof archivo.name !== "string" || typeof archivo.url !== "string" || !Number.isFinite(archivo.size)
      )) {
        throw new Error("El servidor local devolvió un índice de PDF inválido.");
      }
      archivos = indice.files;
      fuenteIndice = "carpeta local";
      if (window.guardarCacheDatos) {
        try {
          await window.guardarCacheDatos(PDF_CACHE_KEY, archivos);
        } catch (error) {
          console.error("No se pudo actualizar la caché del índice PDF:", error);
        }
      }
    } catch (error) {
      errorIndice = error;
      console.error("No se pudo actualizar el índice de PDF local:", error);
      if (window.obtenerCacheDatos) {
        try {
          const cache = await window.obtenerCacheDatos(PDF_CACHE_KEY);
          if (Array.isArray(cache?.value)) {
            archivos = cache.value;
            fuenteIndice = "caché local";
          }
        } catch (cacheError) {
          console.error("No se pudo leer la caché del índice PDF:", cacheError);
        }
      }
    }
  }

  if (window.obtenerPdfsCarpeta) {
    try {
      const archivosNavegador = await window.obtenerPdfsCarpeta();
      archivos = [...archivos, ...archivosNavegador];
      if (archivosNavegador.length && !fuenteIndice) fuenteIndice = "carpeta seleccionada en este navegador";
    } catch (error) {
      console.error("No se pudo leer el índice PDF privado de este navegador:", error);
    }
  }

  const rutasIncluidas = new Set();
  PDF_INDEX_FILES = archivos.filter(archivo => {
    const ruta = normalizarUrlPdf(archivo.url);
    if (rutasIncluidas.has(ruta)) return false;
    rutasIncluidas.add(ruta);
    return true;
  });
  archivos = PDF_INDEX_FILES;
  const sinAsignar = agregarIndicePdf(DB_EXPS, archivos);

  let estado = `${DB_EXPS.length} expediente(s); ${archivos.length} PDF detectado(s)`;
  if (fuenteExpedientes) estado += ` — datos: ${fuenteExpedientes}`;
  if (fuenteIndice) estado += ` — documentos: ${fuenteIndice}`;
  if (sinAsignar) estado += ` — ${sinAsignar} PDF sin expediente asignado`;
  if (errorCarga) estado += expedientesRemotos
    ? " — servidor de datos no disponible; se usa la caché local"
    : " — no se pudieron actualizar los datos del servidor";
  if (errorIndice) estado += archivos.length
    ? " — servidor de archivos no disponible; se usa la caché"
    : " — no se pudo leer la carpeta de PDF";
  const error = (!!errorCarga && !expedientesRemotos) || !!errorIndice;
  if (errorCarga && expedientesRemotos) console.warn("Se muestran los expedientes guardados en caché tras fallar la red.");
  actualizarEstadoDatos(estado, error);
}

window.agregarExpedientesPrivados = async expedientes => {
  await window.guardarCacheDatos(BROWSER_EXPEDIENTES_CACHE_KEY, expedientes);
  return fusionarExpedientesPrivados(expedientes);
};

function getCustomExps() { return JSON.parse(localStorage.getItem("sice_exps_v2") || "[]"); }
function saveCustomExps(arr) { localStorage.setItem("sice_exps_v2", JSON.stringify(arr)); }
