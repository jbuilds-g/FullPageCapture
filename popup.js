const captureButton = document.querySelector("#capture");
const saveButton = document.querySelector("#save");
const formatSelect = document.querySelector("#format");
const statusEl = document.querySelector("#status");
const progressWrap = document.querySelector("#progress-wrap");
const progressEl = document.querySelector("#progress");
const exportOptions = document.querySelector("#export-options");
const settingsButton = document.querySelector("#settings");
const openExportButton = document.querySelector("#open-export");
const openLibraryButton = document.querySelector("#open-library");
let completedDownloadId = null;
let latestExportAvailable = false;

openLibraryButton.addEventListener("click", async () => {
  try { await chrome.tabs.create({ url: chrome.runtime.getURL("library.html") }); }
  catch (error) { setStatus("Could not open the Library. " + (error?.message || "")); }
});

openExportButton.addEventListener("click", async () => {
  if (!latestExportAvailable) return;
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL("open.html") });
  } catch (error) {
    setStatus("Could not open the saved file. " + (error?.message || ""));
  }
});
const DEFAULT_SETTINGS = { defaultFormat: "png", filenamePattern: "{title}-full-page", saveFolder: "FullPageCapture", showSaveDialog: false, libraryEnabled: false };

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
loadSettings().then(settings => { formatSelect.value = settings.defaultFormat; }).catch(() => {});

let capturedCanvas = null;
let capturedTitle = "page";
let originalScrollY = 0;

function setStatus(message) {
  statusEl.textContent = message;
}

function setProgress(value) {
  progressWrap.hidden = false;
  progressEl.style.width = Math.max(0, Math.min(100, value)) + "%";
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function execute(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  if (!results || !results[0]) throw new Error("Could not access this page.");
  return results[0].result;
}

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  saveButton.disabled = true;
  exportOptions.hidden = true;
  capturedCanvas = null;
  setProgress(0);
  setStatus("Preparing page…");

  let tabId;
  let restoreNeeded = false;
  let originalScroll = 0;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab was found.");
    tabId = tab.id;
    capturedTitle = (tab.title || "page").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 100) || "page";

    const page = await execute(tabId, () => {
      const root = document.documentElement;
      const body = document.body;
      if (!root || !body) throw new Error("This page has no document to capture.");

      const documentScroller = document.scrollingElement || root;
      const candidates = [documentScroller, ...document.querySelectorAll("*")].filter((el, index, all) =>
        all.indexOf(el) === index &&
        el.scrollHeight > el.clientHeight + 120 &&
        (el === documentScroller || /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY))
      );
      candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
      const target = candidates[0] || documentScroller;
      const isDocument = target === documentScroller || target === root || target === body;
      const rect = isDocument
        ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight }
        : (() => {
            const r = target.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          })();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollHeight = Math.max(target.scrollHeight, target.clientHeight);
      const scrollTop = isDocument ? window.scrollY : target.scrollTop;
      const maxScroll = Math.max(0, scrollHeight - (isDocument ? viewportHeight : target.clientHeight));
      const width = isDocument
        ? Math.max(root.scrollWidth, body.scrollWidth, root.clientWidth)
        : viewportWidth;
      const height = isDocument
        ? Math.max(root.scrollHeight, body.scrollHeight, root.clientHeight)
        : Math.ceil(Math.max(viewportHeight, rect.top + scrollHeight + Math.max(0, viewportHeight - rect.bottom)));

      target.setAttribute("data-fpc-scroll-target", "true");
      const fixed = [];
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if ((style.position === "fixed" || style.position === "sticky") &&
            style.display !== "none" && style.visibility !== "hidden") {
          el.setAttribute("data-fpc-original-visibility", el.style.visibility);
          el.style.visibility = "hidden";
        }
      }
      if (isDocument) window.scrollTo(0, 0);
      else target.scrollTop = 0;
      return {
        width, height, viewportWidth, viewportHeight, maxScroll, scrollTop,
        step: Math.max(180, Math.floor((isDocument ? viewportHeight : target.clientHeight) * 0.72)),
        isDocument, targetLeft: rect.left, targetTop: rect.top,
        targetWidth: rect.width, targetHeight: rect.height,
        scrollHeight, clientHeight: target.clientHeight
      };
    });
    restoreNeeded = true;
    originalScroll = page?.scrollTop || 0;

    if (!page || !page.width || !page.height) throw new Error("Could not measure this page.");
    if (page.height > 30000 || page.width > 12000) {
      throw new Error("This page is too large for a reliable single-image capture (limit: 30,000 px tall and 12,000 px wide).");
    }

    setStatus("Capturing full page…");
    const firstShot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const firstImage = await loadImage(firstShot);
    const scale = firstImage.naturalWidth / page.viewportWidth;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.width * scale);
    canvas.height = Math.round(page.height * scale);
    if (canvas.width * canvas.height > 150000000) throw new Error("The resulting image would be too large for this browser to handle.");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not create the image canvas.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(firstImage, 0, 0);

    const positions = [];
    for (let y = 0; y < page.maxScroll; y += page.step) positions.push(y);
    if (positions.length === 0 || positions[positions.length - 1] !== page.maxScroll) positions.push(page.maxScroll);

    for (let i = 0; i < positions.length; i++) {
      const y = positions[i];
      await execute(tabId, targetY => {
        const target = document.querySelector('[data-fpc-scroll-target="true"]');
        if (!target) throw new Error("The page's scroll area could not be found.");
        if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
          window.scrollTo(0, targetY);
        } else {
          target.scrollTop = targetY;
        }
      }, [y]);
      await delay(550);
      const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      const img = await loadImage(shot);
      if (page.isDocument) {
        ctx.drawImage(img, 0, Math.round(y * scale));
      } else {
        const sx = Math.max(0, Math.round(page.targetLeft * scale));
        const sy = Math.max(0, Math.round(page.targetTop * scale));
        const sw = Math.min(img.naturalWidth - sx, Math.round(page.targetWidth * scale));
        const sh = Math.min(img.naturalHeight - sy, Math.round(page.targetHeight * scale));
        const dy = Math.round((page.targetTop + y) * scale);
        if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, sx, dy, sw, sh);
      }
      setProgress(Math.round(((i + 1) / positions.length) * 100));
      setStatus("Capturing page section " + (i + 1) + " of " + positions.length + "…");
    }

    capturedCanvas = canvas;
    exportOptions.hidden = false;
    setStatus("Capture ready: " + canvas.width + " × " + canvas.height + " pixels.");
  } catch (error) {
    setStatus(error?.message || "Capture failed. Try another page.");
  } finally {
    if (tabId && restoreNeeded) {
      try {
        await execute(tabId, y => {
          for (const el of document.querySelectorAll("[data-fpc-original-visibility]")) {
            el.style.visibility = el.getAttribute("data-fpc-original-visibility");
            el.removeAttribute("data-fpc-original-visibility");
          }
          const target = document.querySelector('[data-fpc-scroll-target="true"]');
          if (target) {
            target.removeAttribute("data-fpc-scroll-target");
            if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
              window.scrollTo(0, y);
            } else {
              target.scrollTop = y;
            }
          } else {
            window.scrollTo(0, y);
          }
        }, [originalScroll]);
      } catch (_) {}
    }
    captureButton.disabled = false;
    saveButton.disabled = !capturedCanvas;
  }
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read a captured page section."));
    img.src = src;
  });
}

saveButton.addEventListener("click", async () => {
  if (!capturedCanvas) return;
  saveButton.disabled = true;
  openExportButton.hidden = true;
  completedDownloadId = null;
  latestExportAvailable = false;
  try {
    const settings = await loadSettings();
    const format = formatSelect.value;
    setStatus("Preparing " + format.toUpperCase() + " export…");
    let blob;
    let mime;
    let extension;
    if (format === "pdf") {
      blob = makePdf(capturedCanvas);
      mime = "application/pdf";
      extension = "pdf";
    } else {
      mime = format === "jpeg" ? "image/jpeg" : "image/png";
      extension = format === "jpeg" ? "jpg" : "png";
      blob = await new Promise((resolve, reject) => capturedCanvas.toBlob(
        result => result ? resolve(result) : reject(new Error("Could not encode the image.")),
        mime,
        format === "jpeg" ? 0.92 : undefined
      ));
    }
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("-");
    const baseName = (settings.filenamePattern || DEFAULT_SETTINGS.filenamePattern)
      .replaceAll("{title}", capturedTitle).replaceAll("{date}", date).replaceAll("{time}", time)
      .replace(/[\\/:*?"<>|]+/g, "_").trim() || capturedTitle;
    const folder = (settings.saveFolder || "").replace(/\\/g, "/").split("/").filter(part => part && part !== "." && part !== "..").join("/");
    const filename = (folder ? folder + "/" : "") + baseName + "." + extension;
    if (settings.libraryEnabled) {
      try { await storeLibraryCapture({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()), filename, title: capturedTitle, format: extension.toUpperCase(), createdAt: Date.now(), width: capturedCanvas.width, height: capturedCanvas.height, blob }); }
      catch (error) { setStatus("Export prepared, but Library could not save a copy: " + (error?.message || "storage error")); }
    }
    try {
      await storeLatestExport(blob, filename);
      latestExportAvailable = true;
    } catch (_) {
      latestExportAvailable = false;
    }
    try {
      const downloadsApi = typeof browser !== "undefined" ? browser.downloads : chrome.downloads;
      if (!downloadsApi?.download) throw new Error("Direct downloads are unavailable.");
      const objectUrl = URL.createObjectURL(blob);
      try {
        completedDownloadId = await downloadsApi.download({ url: objectUrl, filename, conflictAction: "uniquify", saveAs: Boolean(settings.showSaveDialog) });
        setStatus("Extraction started: " + filename);
        openExportButton.hidden = true;
        const onChanged = delta => {
          if (delta.id !== completedDownloadId) return;
          if (delta.state?.current === "complete") {
            downloadsApi.onChanged.removeListener(onChanged);
            setStatus("Extraction completed: " + filename);
            openExportButton.hidden = !latestExportAvailable;
          } else if (delta.state?.current === "interrupted") {
            downloadsApi.onChanged.removeListener(onChanged);
            setStatus("Extraction failed: " + (delta.error?.current || "The browser interrupted the download."));
          }
        };
        downloadsApi.onChanged.addListener(onChanged);
        const [download] = await downloadsApi.search({ id: completedDownloadId });
        if (download?.state === "complete") {
          downloadsApi.onChanged.removeListener(onChanged);
          setStatus("Extraction completed: " + filename);
          openExportButton.hidden = !latestExportAvailable;
        } else if (download?.state === "interrupted") {
          downloadsApi.onChanged.removeListener(onChanged);
          setStatus("Extraction failed: " + (download.error || "The browser interrupted the download."));
        }
      } finally {
        // Give the browser time to resolve the object URL before releasing it.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      }
    } catch (downloadError) {
      // Keep the working export-page flow as a fallback if the direct download fails.
      await storePendingExport(blob, filename);
      const tabsApi = typeof browser !== "undefined" ? browser.tabs : chrome.tabs;
      await tabsApi.create({ url: (typeof browser !== "undefined" ? browser.runtime : chrome.runtime).getURL("download.html") });
      setStatus("The export opened in a new tab because automatic extraction was unavailable.");
    }
  } catch (error) {
    setStatus(error?.message || "Export failed. Check the extension's download permission and browser download settings.");
  } finally {
    saveButton.disabled = false;
  }
});



function storeLatestExport(blob, filename) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fullPageCaptureExports", 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("exports")) request.result.createObjectStore("exports"); if (!request.result.objectStoreNames.contains("library")) request.result.createObjectStore("library", { keyPath: "id" }); };
    request.onerror = () => reject(new Error("Could not prepare the file preview."));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("exports", "readwrite");
      transaction.objectStore("exports").put({ blob, filename }, "latest");
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(new Error("Could not save the file preview.")); };
      transaction.onabort = () => { db.close(); reject(new Error("Could not save the file preview.")); };
    };
  });
}

function storePendingExport(blob, filename) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fullPageCaptureExports", 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("exports")) request.result.createObjectStore("exports"); if (!request.result.objectStoreNames.contains("library")) request.result.createObjectStore("library", { keyPath: "id" }); };
    request.onerror = () => reject(new Error("Could not prepare the export. Please reload the extension and try again."));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("exports", "readwrite");
      transaction.objectStore("exports").put({ blob, filename }, "pending");
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(new Error("Could not store the export for download."));
      };
      transaction.onabort = () => {
        db.close();
        reject(new Error("The export could not be saved for download."));
      };
    };
  });
}

function makePdf(canvas) {
  // Build a minimal one-page PDF with the full capture embedded as a JPEG image.
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const jpeg = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) jpeg[i] = binary.charCodeAt(i);

  const pageWidth = canvas.width * 0.75;
  const pageHeight = canvas.height * 0.75;
  const encoder = new TextEncoder();
  const chunks = [];
  let totalLength = 0;
  const offsets = [0];
  const append = bytes => {
    chunks.push(bytes);
    totalLength += bytes.length;
  };
  const ascii = value => encoder.encode(value);

  append(ascii("%PDF-1.4\n%âãÏÓ\n"));
  offsets[1] = totalLength;
  append(ascii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
  offsets[2] = totalLength;
  append(ascii("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"));
  offsets[3] = totalLength;
  append(ascii("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"));
  offsets[4] = totalLength;
  append(ascii("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n"));
  append(jpeg);
  append(ascii("\nendstream\nendobj\n"));
  const content = "q\n" + pageWidth + " 0 0 " + pageHeight + " 0 0 cm\n/Im0 Do\nQ\n";
  offsets[5] = totalLength;
  append(ascii("5 0 obj\n<< /Length " + encoder.encode(content).length + " >>\nstream\n" + content + "endstream\nendobj\n"));
  const xrefOffset = totalLength;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  xref += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";
  append(ascii(xref));
  return new Blob(chunks, { type: "application/pdf" });
}


function storeLibraryCapture(item) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fullPageCaptureExports", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("exports")) request.result.createObjectStore("exports");
      if (!request.result.objectStoreNames.contains("library")) request.result.createObjectStore("library", { keyPath: "id" });
    };
    request.onerror = () => reject(new Error("Could not open Library storage."));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("library", "readwrite");
      transaction.objectStore("library").put(item);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(new Error("Could not save this capture to the Library.")); };
      transaction.onabort = () => { db.close(); reject(new Error("Library storage was interrupted.")); };
    };
  });
}
