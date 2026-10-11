/* ================================================================
   SICE - pdf_storage.js
   Almacenamiento Local de Documentos PDF en IndexedDB
   Permite subir y persistir archivos PDF reales en el navegador
================================================================ */

function abrirSiceDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sice_storage_v1", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pdfs")) {
        db.createObjectStore("pdfs", { keyPath: "id" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(req.error);
  });
}

async function guardarPdfLocal(file) {
  const db = await abrirSiceDB();
  const id = "pdf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readwrite");
    const store = tx.objectStore("pdfs");
    store.put({
      id: id,
      nombre: file.name,
      tamano: file.size,
      tipo: file.type || "application/pdf",
      blob: file,
      fecha: Date.now()
    });
    tx.oncomplete = () => resolve("idb:" + id);
    tx.onerror = () => reject(tx.error);
  });
}

async function obtenerPdfLocal(idbKey) {
  const id = idbKey.replace("idb:", "");
  const db = await abrirSiceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readonly");
    const store = tx.objectStore("pdfs");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function abrirSiceCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sice_expedientes_cache_v1", 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pdfs")) {
        db.createObjectStore("pdfs", { keyPath: "url" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function guardarCacheDatos(key, value) {
  const db = await abrirSiceCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache", "readwrite");
    tx.objectStore("cache").put({ key, value, updatedAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
  });
}

async function obtenerCacheDatos(key) {
  const db = await abrirSiceCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache", "readonly");
    const req = tx.objectStore("cache").get(key);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { const error = req.error; db.close(); reject(error); };
  });
}

async function guardarPdfCache(url, blob, lastModified) {
  const db = await abrirSiceCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readwrite");
    tx.objectStore("pdfs").put({ url, blob, lastModified, size: blob.size, updatedAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
  });
}

async function obtenerPdfCache(url) {
  const db = await abrirSiceCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readonly");
    const req = tx.objectStore("pdfs").get(url);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { const error = req.error; db.close(); reject(error); };
  });
}

async function eliminarPdfCache(url) {
  const db = await abrirSiceCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfs", "readwrite");
    tx.objectStore("pdfs").delete(url);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
  });
}

async function esPdfValido(blob) {
  if (!blob || typeof blob.slice !== "function" || blob.size < 5) return false;
  const header = new TextDecoder("latin1").decode(await blob.slice(0, 1024).arrayBuffer());
  return /%PDF-\d\.\d/.test(header);
}

const CARPETA_PDFS_CACHE_KEY = "browser-folder-pdfs-v1";
const CARPETA_EXPEDIENTES_CACHE_KEY = "browser-folder-expedientes-v1";

async function obtenerPdfsCarpeta() {
  const cache = await obtenerCacheDatos(CARPETA_PDFS_CACHE_KEY);
  const files = Array.isArray(cache?.value) ? cache.value : [];
  const validFiles = [];
  for (const file of files) {
    const url = new URL(file.url, location.href).href;
    const cachedPdf = await obtenerPdfCache(url);
    if (cachedPdf?.blob && await esPdfValido(cachedPdf.blob)) {
      validFiles.push(file);
    } else {
      if (cachedPdf) await eliminarPdfCache(url);
    }
  }
  if (validFiles.length !== files.length) {
    await guardarCacheDatos(CARPETA_PDFS_CACHE_KEY, validFiles);
  }
  return validFiles;
}

async function importarPdfsCarpeta(files, onProgress) {
  const pdfFiles = Array.from(files || []).filter(file => /\.pdf$/i.test(file.name));
  if (!pdfFiles.length) throw new Error("No se encontraron archivos PDF en la carpeta seleccionada.");

  const anteriores = await obtenerPdfsCarpeta();
  const porUrl = new Map(anteriores.map(file => [file.url, file]));
  const expectedBytes = pdfFiles.reduce((total, file) => {
    const relativePath = String(file.webkitRelativePath || file.name).replace(/\\/g, "/");
    const folderIndex = relativePath.toLowerCase().lastIndexOf("/expedientes/");
    const path = folderIndex >= 0
      ? relativePath.slice(folderIndex + 1)
      : relativePath.toLowerCase().startsWith("expedientes/")
        ? relativePath
        : `expedientes/${relativePath.split("/").slice(1).join("/") || file.name}`;
    const url = path.split("/").map(encodeURIComponent).join("/");
    const existing = porUrl.get(url);
    return total + (existing?.size === file.size && existing.lastModified === String(file.lastModified) ? 0 : file.size);
  }, 0);
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    const available = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0));
    if (available && available < expectedBytes * 1.05) {
      throw new Error(`Se necesitan aproximadamente ${Math.ceil(expectedBytes / 1048576)} MB y el navegador dispone de ${Math.floor(available / 1048576)} MB libres.`);
    }
  }

  let completed = 0;
  let failed = 0;
  let invalid = 0;
  let quotaExceeded = false;

  for (const file of pdfFiles) {
    const relativePath = String(file.webkitRelativePath || file.name).replace(/\\/g, "/");
    const folderIndex = relativePath.toLowerCase().lastIndexOf("/expedientes/");
    const path = folderIndex >= 0
      ? relativePath.slice(folderIndex + 1)
      : relativePath.toLowerCase().startsWith("expedientes/")
        ? relativePath
        : `expedientes/${relativePath.split("/").slice(1).join("/") || file.name}`;
    const url = path.split("/").map(encodeURIComponent).join("/");
    const entry = { name: file.name, path, url, size: file.size, lastModified: String(file.lastModified) };

    if (!await esPdfValido(file)) {
      porUrl.delete(url);
      await eliminarPdfCache(new URL(url, location.href).href);
      invalid++;
      failed++;
      completed++;
      onProgress?.({ completed, total: pdfFiles.length, failed, cached: porUrl.size });
      continue;
    }
    try {
      if (quotaExceeded) throw new DOMException("Se agotó el espacio de almacenamiento.", "QuotaExceededError");
      const cacheKey = new URL(url, location.href).href;
      const existing = await obtenerPdfCache(cacheKey);
      if (existing?.lastModified !== entry.lastModified || existing.size !== entry.size ||
          !await esPdfValido(existing.blob)) {
        await guardarPdfCache(cacheKey, file, entry.lastModified);
      }
      porUrl.set(url, entry);
    } catch (error) {
      failed++;
      if (error.name === "QuotaExceededError") quotaExceeded = true;
      console.error("No se pudo guardar un PDF seleccionado en la caché del navegador:", error);
    }

    completed++;
    onProgress?.({ completed, total: pdfFiles.length, failed, cached: porUrl.size });
  }

  const guardados = Array.from(porUrl.values());
  await guardarCacheDatos(CARPETA_PDFS_CACHE_KEY, guardados);
  return { completed, total: pdfFiles.length, failed, invalid, cached: guardados.length };
}

async function olvidarDatosCarpeta() {
  const files = await obtenerPdfsCarpeta();
  const db = await abrirSiceCacheDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["cache", "pdfs"], "readwrite");
    const cache = tx.objectStore("cache");
    cache.delete(CARPETA_PDFS_CACHE_KEY);
    cache.delete(CARPETA_EXPEDIENTES_CACHE_KEY);
    const pdfs = tx.objectStore("pdfs");
    files.forEach(file => pdfs.delete(new URL(file.url, location.href).href));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
  });
}

async function precargarPDFs(files, onProgress) {
  if (!Array.isArray(files) || !files.length) throw new Error("No hay PDF locales para guardar.");
  const expectedBytes = files.reduce((total, file) => total + (Number(file.size) || 0), 0);
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    const available = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0));
    if (available && available < expectedBytes * 1.05) {
      throw new Error(`Se necesitan aproximadamente ${Math.ceil(expectedBytes / 1048576)} MB y el navegador dispone de ${Math.floor(available / 1048576)} MB libres.`);
    }
  }

  let completed = 0;
  let failed = 0;
  let cached = 0;
  let quotaExceeded = false;
  for (const file of files) {
    try {
      const url = new URL(file.url, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/expedientes/") || !url.pathname.toLowerCase().endsWith(".pdf")) {
        throw new Error("La ruta del PDF no pertenece a la carpeta local de expedientes.");
      }
      if (quotaExceeded) throw new DOMException("Se agotó el espacio de almacenamiento.", "QuotaExceededError");

      const existing = await obtenerPdfCache(url.href);
      if (existing?.lastModified === file.lastModified && existing.size === file.size &&
          await esPdfValido(existing.blob)) {
        cached++;
      } else {
        const response = await fetch(url.href, { cache: "no-cache" });
        if (!response.ok) throw new Error(`No se pudo descargar el PDF (HTTP ${response.status}).`);
        if (response.headers.get("Content-Type")?.split(";")[0] !== "application/pdf") {
          throw new Error("El archivo recibido no es un PDF.");
        }
        const blob = await response.blob();
        if (!await esPdfValido(blob)) throw new Error("El archivo recibido no contiene un PDF válido.");
        await guardarPdfCache(url.href, blob, file.lastModified);
        cached++;
      }
    } catch (error) {
      failed++;
      if (error.name === "QuotaExceededError") quotaExceeded = true;
      console.error("Error al guardar un PDF en la caché local:", error);
    }
    completed++;
    onProgress?.({ completed, total: files.length, failed, cached });
  }

  return { completed, total: files.length, failed, cached };
}

window.abrirSiceDB = abrirSiceDB;
window.guardarPdfLocal = guardarPdfLocal;
window.obtenerPdfLocal = obtenerPdfLocal;
window.guardarCacheDatos = guardarCacheDatos;
window.obtenerCacheDatos = obtenerCacheDatos;
window.guardarPdfCache = guardarPdfCache;
window.obtenerPdfCache = obtenerPdfCache;
window.eliminarPdfCache = eliminarPdfCache;
window.esPdfValido = esPdfValido;
window.precargarPDFs = precargarPDFs;
window.obtenerPdfsCarpeta = obtenerPdfsCarpeta;
window.importarPdfsCarpeta = importarPdfsCarpeta;
window.olvidarDatosCarpeta = olvidarDatosCarpeta;
