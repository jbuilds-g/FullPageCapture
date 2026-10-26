const statusEl = document.querySelector("#status");
const downloadButton = document.querySelector("#download");

let exportBlob = null;
let exportFilename = "full-page-capture.png";
let objectUrl = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function readPendingExport() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fullPageCaptureExports", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("exports");
    };
    request.onerror = () => reject(new Error("Could not open the saved export. Return to the extension and capture the page again."));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("exports", "readonly");
      const getRequest = transaction.objectStore("exports").get("pending");
      getRequest.onsuccess = () => {
        const value = getRequest.result;
        db.close();
        resolve(value || null);
      };
      getRequest.onerror = () => {
        db.close();
        reject(new Error("Could not read the saved export."));
      };
    };
  });
}

function clearPendingExport() {
  return new Promise(resolve => {
    const request = indexedDB.open("fullPageCaptureExports", 1);
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("exports", "readwrite");
      transaction.objectStore("exports").delete("pending");
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}

async function initialize() {
  try {
    const item = await readPendingExport();
    if (!item?.blob || !(item.blob instanceof Blob)) {
      setStatus("No pending capture was found. Return to the extension and capture a page first.");
      return;
    }
    exportBlob = item.blob;
    exportFilename = item.filename || exportFilename;
    objectUrl = URL.createObjectURL(exportBlob);
    downloadButton.disabled = false;
    setStatus("Starting download: " + exportFilename + ". If it doesn't start, click Download file.");
    triggerDownload();
    await clearPendingExport();
  } catch (error) {
    setStatus(error?.message || "Could not prepare the download.");
  }
}

function triggerDownload() {
  if (!exportBlob || !objectUrl) return;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = exportFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

downloadButton.addEventListener("click", async () => {
  if (!exportBlob || !objectUrl) return;
  try {
    triggerDownload();
    setStatus("Download requested. Check your browser's downloads list.");
    await clearPendingExport();
  } catch (error) {
    setStatus("Download failed: " + (error?.message || "unknown error") + ". Try clicking Download file again.");
  }
});

window.addEventListener("pagehide", () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

initialize();
