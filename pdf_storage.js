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

window.abrirSiceDB = abrirSiceDB;
window.guardarPdfLocal = guardarPdfLocal;
window.obtenerPdfLocal = obtenerPdfLocal;
