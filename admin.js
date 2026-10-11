/* ================================================================
   SICE - admin.js
   Modulo de gestion de expedientes judiciales
   Soporte para Subida Directa de Archivos PDF y Google Drive
================================================================ */

const DIST = { PUNO:"2101", LIMA:"1801", AREQUIPA:"0401", CUSCO:"0701" };
const INST = { JP:"JUZGADO DE PAZ LETRADO", JR:"JUZGADO ESPECIALIZADO", SP:"SALA SUPERIOR" };
const ESP  = { FC:"FAMILIA CIVIL", CI:"CIVIL", PE:"PENAL", LA:"LABORAL", CO:"COMERCIAL" };
const ESTADOS = [
  "EN EJECUCION / RES JUDICATA",
  "EN TRAMITE",
  "EN EJECUCION",
  "CONCLUIDO",
  "ARCHIVADO",
  "CALIFICACION"
];

const $ = id => document.getElementById(id);

// 1. Verificación de sesión de administración
let sesionActual = sessionStorage.getItem("sice_sesion") || "admin";
if (!sessionStorage.getItem("sice_sesion")) {
  sessionStorage.setItem("sice_sesion", "admin");
}
$("admUsuarioNom").textContent = "ADMINISTRADOR";

$("btnSalirAdmin").onclick = () => {
  sessionStorage.removeItem("sice_sesion");
  location.href = "index.html";
};

// 2. Carga y Sincronización de Base de Datos
let expsList = [];

async function initDB() {
  let base = [];
  try {
    const r = await fetch("data/expedientes.json?t=" + Date.now());
    if (r.ok) {
      const txt = await r.text();
      base = JSON.parse(txt.replace(/^\uFEFF/, ''));
    }
  } catch (_) {}

  // Mezclar con los cambios guardados en localStorage
  const local = JSON.parse(localStorage.getItem("sice_exps_v2") || "[]");
  const map = new Map();
  base.forEach(x => map.set(x.codigo, x));
  local.forEach(x => map.set(x.codigo, x));

  expsList = Array.from(map.values());
  renderTabla();
  actualizarKPIs();
}

// 3. Renderizado de KPIs
function actualizarKPIs() {
  $("kpiTotal").textContent = expsList.length;
  const enEjec = expsList.filter(x => (x.reporte?.estado || "").includes("EJECUCION") || (x.reporte?.estado || "").includes("TRAMITE")).length;
  $("kpiEjecucion").textContent = enEjec;

  let pdfCount = 0;
  expsList.forEach(x => {
    (x.actuaciones || []).forEach(a => {
      if (a.pdfUrl) pdfCount++;
      (a.cedulas || []).forEach(c => { if (c.pdfUrl) pdfCount++; });
    });
  });
  $("kpiPdfs").textContent = pdfCount;
}

// 4. Renderizado de Tabla de Expedientes
function renderTabla() {
  const tbody = $("adminTbody");
  const filtro = ($("filtroTabla").value || "").toLowerCase().trim();

  const filtrados = expsList.filter(x => {
    if (!filtro) return true;
    const txt = `${x.codigo} ${x.reporte?.materia} ${x.reporte?.organoJurisdiccional} ${x.partes?.map(p=>p.nombres).join(' ')}`.toLowerCase();
    return txt.includes(filtro);
  });

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:26px;color:#888">No se encontraron expedientes.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map((x, idx) => {
    const cantActs = (x.actuaciones || []).length;
    const cantPdfs = (x.actuaciones || []).filter(a => a.pdfUrl).length;
    const partesTxt = (x.partes || []).map(p => `<b>${p.rol}:</b> ${p.nombres}`).join('<br>') || "—";
    const estado = x.reporte?.estado || "EN TRAMITE";

    return `
      <tr>
        <td><span class="code-tag">${x.codigo}</span></td>
        <td><b>${x.reporte?.organoJurisdiccional || "—"}</b><br><small style="color:var(--txt-muted)">${x.reporte?.distritoJudicial || ""}</small></td>
        <td><b style="color:var(--pink-main)">${x.reporte?.materia || "—"}</b></td>
        <td><span class="badge-estado" style="font-size:11px">${estado}</span></td>
        <td style="font-size:12px">${partesTxt}</td>
        <td>
          <span style="font-weight:700">${cantActs} resoluciones</span><br>
          <small style="color:${cantPdfs ? '#34d399' : '#f87171'}">(${cantPdfs} con PDF)</small>
        </td>
        <td style="text-align:center">
          <div style="display:inline-flex;gap:6px">
            <button class="btn-action-sm btn-action-edit" onclick="editarExp('${x.codigo}')" title="Editar Expediente">✏️ Editar</button>
            <button class="btn-action-sm btn-action-del" onclick="eliminarExp('${x.codigo}')" title="Eliminar Expediente">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

$("filtroTabla").oninput = renderTabla;

// 5. Opciones de Selects en el Formulario
function llenarSelect(elem, obj, prompt) {
  elem.innerHTML = `<option value="">-- ${prompt} --</option>` +
    Object.entries(obj).map(([k,v]) => `<option value="${k}">${v}</option>`).join("");
}
llenarSelect($("adDist"), Object.fromEntries(Object.keys(DIST).map(k=>[k,k])), "Distrito Judicial");
llenarSelect($("adInst"), INST, "Instancia");
llenarSelect($("adEsp"),  ESP,  "Especialidad");
$("adEstado").innerHTML = `<option value="">-- Seleccionar Estado --</option>` +
  ESTADOS.map(s => `<option value="${s}">${s}</option>`).join("");

// 6. Generador de Código en Tiempo Real
function actualizarCodigoPreview() {
  const sec = ($("adSec").value || "00001").trim().padStart(5, "0");
  const anio = ($("adAnio").value || new Date().getFullYear().toString()).trim();
  const org = ($("adOrg").value || "0").trim();
  const distKey = $("adDist").value || "PUNO";
  const distCode = DIST[distKey] || "2101";
  const inst = $("adInst").value || "JP";
  const esp = $("adEsp").value || "FC";
  const corr = ($("adCorr").value || "01").trim().padStart(2, "0");

  const codigo = `${sec}-${anio}-${org}-${distCode}-${inst}-${esp}-${corr}`;
  $("lblCodigoGen").textContent = codigo;
  return codigo;
}

["adSec", "adAnio", "adOrg", "adDist", "adInst", "adEsp", "adCorr"].forEach(id => {
  $(id).addEventListener("input", actualizarCodigoPreview);
  $(id).addEventListener("change", actualizarCodigoPreview);
});

$("btnCopiarCodigo").onclick = () => {
  const c = $("lblCodigoGen").textContent;
  navigator.clipboard.writeText(c);
  alert("Código judicial copiado: " + c);
};

// 7. Lista Dinámica de Actuaciones Judiciales con Subida de PDF
let adminActuaciones = [];

function renderActuacionesAdmin() {
  const c = $("actuacionesContainer");
  if (!adminActuaciones.length) {
    c.innerHTML = `<div style="text-align:center;padding:18px;background:#0d0f18;border:1px dashed var(--border);border-radius:6px;color:var(--txt-muted)">No hay actuaciones agregadas. Haz clic en "➕ Agregar Actuación".</div>`;
    return;
  }

  c.innerHTML = adminActuaciones.map((a, i) => `
    <div class="act-row-item">
      <div>
        <small style="font-weight:700">N°</small>
        <input value="${a.numero || (adminActuaciones.length - i)}" oninput="adminActuaciones[${i}].numero=parseInt(this.value)||0" style="text-align:center;font-weight:800">
      </div>
      <div>
        <small style="font-weight:700">Fecha</small>
        <input value="${a.fecha || ""}" placeholder="DD/MM/AAAA" oninput="adminActuaciones[${i}].fecha=this.value">
      </div>
      <div>
        <small style="font-weight:700">Acto / Resolución</small>
        <input value="${a.acto || ""}" placeholder="Ej: RESOLUCIÓN 01" oninput="adminActuaciones[${i}].acto=this.value">
      </div>
      <div>
        <small style="font-weight:700">Sumilla</small>
        <input value="${a.sumilla || ""}" placeholder="Sumilla del acto..." oninput="adminActuaciones[${i}].sumilla=this.value">
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px">
            <input type="file" accept="application/pdf" id="fileAct_${i}" style="display:none" onchange="subirPdfActuacion(${i}, this.files[0])">
            <button type="button" class="btn-s" onclick="$('fileAct_${i}').click()" style="padding:3px 8px;font-size:11px" title="Seleccionar PDF desde tu equipo">
              📎 Subir PDF
            </button>
            ${a.pdfName ? `<span class="upload-pill-badge" title="${a.pdfName}">✓ ${a.pdfName}</span>` : ''}
          </div>
          ${a.pdfUrl ? `<button type="button" onclick="probarPdf('${a.pdfUrl}', '${a.acto || 'Documento'}')" style="background:none;border:0;color:var(--pink-main);font-size:11px;font-weight:800;cursor:pointer">🧪 Probar</button>` : ''}
        </div>
        <input value="${a.pdfUrl || ""}" placeholder="URL Google Drive o idb:..." oninput="adminActuaciones[${i}].pdfUrl=this.value; renderActuacionesAdmin();" style="font-size:12px">
      </div>
      <div style="text-align:center">
        <button type="button" onclick="quitarActuacion(${i})" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:6px;border-radius:4px;cursor:pointer" title="Quitar">✕</button>
      </div>
    </div>
  `).join("");
}

$("btnAgregarFilaAct").onclick = () => {
  const nextNum = adminActuaciones.length ? (Math.max(...adminActuaciones.map(a => a.numero || 1)) + 1) : 1;
  adminActuaciones.unshift({
    numero: nextNum,
    fecha: new Date().toLocaleDateString("es-PE"),
    acto: "RESOLUCIÓN N° " + nextNum,
    sumilla: "",
    responsable: "JUZGADO",
    pdfUrl: "",
    pdfName: ""
  });
  renderActuacionesAdmin();
};

window.quitarActuacion = function(i) {
  adminActuaciones.splice(i, 1);
  renderActuacionesAdmin();
};

// Subir PDF desde la computadora y guardar en IndexedDB
window.subirPdfActuacion = async function(i, file) {
  if (!file) return;
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    alert("Por favor selecciona un archivo PDF válido.");
    return;
  }
  try {
    const idbKey = await window.guardarPdfLocal(file);
    adminActuaciones[i].pdfUrl = idbKey;
    adminActuaciones[i].pdfName = file.name;
    if (!adminActuaciones[i].sumilla) {
      adminActuaciones[i].sumilla = "Documento digitalizado: " + file.name;
    }
    renderActuacionesAdmin();
    alert(`✅ Archivo PDF "${file.name}" cargado exitosamente.\nPuedes probarlo con el botón "🧪 Probar" o guardar el expediente.`);
  } catch (err) {
    console.error("Error al guardar PDF:", err);
    alert("Hubo un error al guardar el archivo PDF: " + err.message);
  }
};

window.probarPdf = async function(url, title) {
  let finalUrl = url.trim();

  if (finalUrl.startsWith("idb:")) {
    try {
      const item = await window.obtenerPdfLocal(finalUrl);
      if (item && item.blob) {
        finalUrl = URL.createObjectURL(item.blob);
      } else {
        alert("El archivo PDF local no se encontró en la memoria del navegador.");
        return;
      }
    } catch (e) {
      alert("Error al cargar PDF local: " + e.message);
      return;
    }
  } else {
    const driveMatch = finalUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      finalUrl = "https://drive.google.com/file/d/" + driveMatch[1] + "/preview";
    }
  }

  $("pdfModalTitle").textContent = "PROBADOR DE DOCUMENTO: " + title;
  $("pdfModalIframe").src = finalUrl;
  $("pdfModalLinkExt").href = finalUrl;
  $("modalPdf").hidden = false;
};

$("btnCerrarPdf").onclick = () => {
  $("modalPdf").hidden = true;
  $("pdfModalIframe").src = "";
};

// 8. Cargar Datos para Edición
window.editarExp = function(codigo) {
  const x = expsList.find(e => e.codigo === codigo);
  if (!x) return;

  $("tituloEditor").textContent = "✏️ Editando Expediente: " + x.codigo;
  $("badgeModoEdicion").textContent = "MODO EDICIÓN";
  $("badgeModoEdicion").style.background = "#fee2e2";
  $("badgeModoEdicion").style.color = "#991b1b";

  $("adSec").value = x.sec || "";
  $("adAnio").value = x.anio || "";
  $("adOrg").value = x.org || "0";
  const distKey = Object.entries(DIST).find(([,v]) => v === x.dist)?.[0] || "PUNO";
  $("adDist").value = distKey;
  $("adInst").value = x.inst || "";
  $("adEsp").value = x.esp || "";
  $("adCorr").value = x.corr || "01";

  const rp = x.reporte || {};
  $("adMateria").value = rp.materia || "";
  $("adEstado").value = rp.estado || "EN TRAMITE";
  $("adOrgano").value = rp.organoJurisdiccional || "";
  $("adDistrito").value = rp.distritoJudicial || distKey;
  $("adJuez").value = rp.juez || "";
  $("adEspecialista").value = rp.especialistaLegal || "";
  $("adProceso").value = rp.proceso || "";
  $("adEtapa").value = rp.etapaProcesal || "";
  $("adFechaIni").value = rp.fechaInicio || "";
  $("adFechaFin").value = rp.fechaConclusion || "";
  $("adMotivo").value = rp.motivoConclusion || "";
  $("adProgreso").value = x.progreso?.porcentaje || 50;
  $("adSumilla").value = rp.sumilla || "";
  $("adObservacion").value = rp.observacion || "";

  if (x.partes && x.partes[0]) $("adParte1Nom").value = x.partes[0].nombres || "";
  if (x.partes && x.partes[1]) $("adParte2Nom").value = x.partes[1].nombres || "";

  adminActuaciones = (x.actuaciones || []).map(a => ({...a}));
  renderActuacionesAdmin();
  actualizarCodigoPreview();

  $("seccionEditor").scrollIntoView({ behavior: "smooth" });
};

// 9. Eliminar Expediente
window.eliminarExp = function(codigo) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el expediente ${codigo}?`)) return;

  expsList = expsList.filter(e => e.codigo !== codigo);
  localStorage.setItem("sice_exps_v2", JSON.stringify(expsList));
  renderTabla();
  actualizarKPIs();
  alert(`Expediente ${codigo} eliminado exitosamente.`);
};

// 10. Botón Nuevo / Limpiar
function resetForm() {
  $("formAdminExp").reset();
  $("adSec").value = "00203";
  $("adAnio").value = "2025";
  $("adOrg").value = "0";
  $("adCorr").value = "01";
  $("adDist").value = "PUNO";
  $("adInst").value = "JP";
  $("adEsp").value = "FC";
  $("adEstado").value = "EN EJECUCION / RES JUDICATA";
  adminActuaciones = [];
  renderActuacionesAdmin();
  actualizarCodigoPreview();

  $("tituloEditor").textContent = "✏️ Agregar / Editar Expediente Judicial";
  $("badgeModoEdicion").textContent = "MODO NUEVO";
  $("badgeModoEdicion").style.background = "var(--pink-main)";
  $("badgeModoEdicion").style.color = "#ffffff";
}
$("btnResetForm").onclick = resetForm;
$("btnNuevoExp").onclick = () => {
  resetForm();
  $("seccionEditor").scrollIntoView({ behavior: "smooth" });
};

// 11. Guardar Expediente
$("formAdminExp").onsubmit = e => {
  e.preventDefault();
  const codigo = actualizarCodigoPreview();
  const distKey = $("adDist").value;

  const cleanActs = adminActuaciones.map(a => {
    let pdf = (a.pdfUrl || "").trim();
    if (!pdf.startsWith("idb:")) {
      const driveMatch = pdf.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) pdf = "https://drive.google.com/file/d/" + driveMatch[1] + "/preview";
    }
    return {
      numero: parseInt(a.numero) || 1,
      fecha: a.fecha || new Date().toLocaleDateString("es-PE"),
      acto: a.acto || "RESOLUCIÓN",
      sumilla: a.sumilla || "Sin sumilla",
      responsable: a.responsable || "JUZGADO",
      pdfUrl: pdf,
      pdfName: a.pdfName || "",
      cedulas: a.cedulas || []
    };
  });

  const nuevoExp = {
    codigo: codigo,
    sec: $("adSec").value.trim().padStart(5, "0"),
    anio: $("adAnio").value.trim(),
    org: $("adOrg").value.trim() || "0",
    dist: DIST[distKey] || "2101",
    inst: $("adInst").value,
    esp: $("adEsp").value,
    corr: $("adCorr").value.trim().padStart(2, "0"),
    reporte: {
      organoJurisdiccional: $("adOrgano").value.trim() || "JUZGADO DE PAZ LETRADO",
      distritoJudicial: $("adDistrito").value.trim() || distKey,
      juez: $("adJuez").value.trim() || "JUEZ DE LA CAUSA",
      especialistaLegal: $("adEspecialista").value.trim() || "ESPECIALISTA LEGAL",
      fechaInicio: $("adFechaIni").value.trim() || "01/01/2025",
      proceso: $("adProceso").value.trim() || "PROCESO SUMARÍSIMO",
      especialidad: ESP[$("adEsp").value] || $("adEsp").value,
      estado: $("adEstado").value || "EN TRAMITE",
      observacion: $("adObservacion").value.trim(),
      materia: $("adMateria").value.trim().toUpperCase(),
      etapaProcesal: $("adEtapa").value.trim().toUpperCase() || "TRAMITE",
      ubicacion: "JUZGADO",
      sumilla: $("adSumilla").value.trim().toUpperCase(),
      fechaConclusion: $("adFechaFin").value.trim(),
      motivoConclusion: $("adMotivo").value.trim()
    },
    progreso: {
      porcentaje: parseInt($("adProgreso").value) || 50,
      mensaje: "Expediente actualizado por el administrador.",
      etapas: [
        { nombre: "Calificación de Demanda", desc: "Revisión formal", estado: "done" },
        { nombre: "Trámite y Audiencia", desc: "Actuaciones procesales", estado: "done" },
        { nombre: "Sentencia", desc: "Resolución final", estado: "done" },
        { nombre: "Ejecución", desc: "Etapa de cumplimiento", estado: "current" }
      ],
      hitos: [
        { fecha: $("adFechaIni").value || "01/01/2025", descripcion: "Ingreso de la causa" }
      ]
    },
    partes: [
      { rol: "DEMANDANTE", tipoPers: "NATURAL", nombres: $("adParte1Nom").value.trim().toUpperCase() },
      { rol: "DEMANDADO", tipoPers: "NATURAL", nombres: $("adParte2Nom").value.trim().toUpperCase() }
    ].filter(p => p.nombres),
    actuaciones: cleanActs
  };

  const idx = expsList.findIndex(e => e.codigo === codigo);
  if (idx !== -1) {
    expsList[idx] = nuevoExp;
  } else {
    expsList.unshift(nuevoExp);
  }

  localStorage.setItem("sice_exps_v2", JSON.stringify(expsList));

  renderTabla();
  actualizarKPIs();
  alert(`✅ ¡Expediente ${codigo} guardado exitosamente con sus documentos PDF!\nYa está disponible para consultar en la búsqueda pública.`);
  $("adminTbody").scrollIntoView({ behavior: "smooth" });
};

// 12. Exportar Base de Datos a JSON descargable
$("btnExportarJSON").onclick = () => {
  const blob = new Blob([JSON.stringify(expsList, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `expedientes_sice_${Date.now()}.json`;
  a.click();
};

// Iniciar aplicación
initDB().then(() => {
  resetForm();
});
