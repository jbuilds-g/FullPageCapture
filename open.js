const statusEl = document.querySelector("#status");
const filenameEl = document.querySelector("#filename");
const previewEl = document.querySelector("#preview");

function readLatestExport() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fullPageCaptureExports", 2);
    request.onerror = () => reject(new Error("Could not access the saved capture."));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("exports")) {
        db.close();
        resolve(null);
        return;
      }
      const transaction = db.transaction("exports", "readonly");
      const getRequest = transaction.objectStore("exports").get("latest");
      getRequest.onsuccess = () => {
        const value = getRequest.result;
        db.close();
        resolve(value || null);
      };
      getRequest.onerror = () => {
        db.close();
        reject(new Error("Could not read the saved capture."));
      };
    };
  });
}

async function initialize() {
  try {
    const item = await readLatestExport();
    if (!item?.blob || !(item.blob instanceof Blob)) {
      statusEl.textContent = "No saved capture preview is available. Save a capture first.";
      return;
    }
    filenameEl.textContent = item.filename || "";
    const url = URL.createObjectURL(item.blob);
    if (item.blob.type === "application/pdf") {
      const frame = document.createElement("iframe");
      frame.className = "preview";
      frame.title = "Saved PDF capture";
      frame.src = url;
      previewEl.appendChild(frame);
    } else if (item.blob.type.startsWith("image/")) {
      const image = document.createElement("img");
      image.className = "preview";
      image.alt = item.filename || "Saved page capture";
      image.src = url;
      previewEl.appendChild(image);
    } else {
      statusEl.textContent = "This file type cannot be previewed in the browser.";
      return;
    }
    statusEl.textContent = "Capture opened.";
    window.addEventListener("pagehide", () => URL.revokeObjectURL(url), { once: true });
  } catch (error) {
    statusEl.textContent = error?.message || "Could not open the saved capture.";
  }
}

initialize();
