const captureButton = document.querySelector("#capture");
const saveButton = document.querySelector("#save");
const formatSelect = document.querySelector("#format");
const statusEl = document.querySelector("#status");
const progressWrap = document.querySelector("#progress-wrap");
const progressEl = document.querySelector("#progress");
const exportOptions = document.querySelector("#export-options");

let capturedCanvas = null;
let capturedTitle = "page";

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
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab was found.");
    tabId = tab.id;
    capturedTitle = (tab.title || "page").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 100) || "page";

    const page = await execute(tabId, () => {
      const root = document.documentElement;
      const body = document.body;
      if (!root || !body) throw new Error("This page has no document to capture.");
      const width = Math.max(root.scrollWidth, body.scrollWidth, root.clientWidth);
      const height = Math.max(root.scrollHeight, body.scrollHeight, root.clientHeight);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, height - viewportHeight);
      const fixed = [];
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if ((style.position === "fixed" || style.position === "sticky") &&
            style.display !== "none" && style.visibility !== "hidden") {
          el.setAttribute("data-fpc-original-visibility", el.style.visibility);
          el.style.visibility = "hidden";
        }
      }
      window.scrollTo(0, 0);
      return { width, height, viewportWidth, viewportHeight, maxScroll, step: Math.max(200, Math.floor(viewportHeight * 0.78)), fixedCount: fixed.length };
    });
    restoreNeeded = true;

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

    const positions = [];
    for (let y = 0; y < page.maxScroll; y += page.step) positions.push(y);
    if (!positions.length || positions[positions.length - 1] !== page.maxScroll) positions.push(page.maxScroll);

    // The first screenshot was taken at scroll position zero, so reuse it.
    ctx.drawImage(firstImage, 0, 0);
    for (let i = 0; i < positions.length; i++) {
      const y = positions[i];
      await execute(tabId, targetY => {
        window.scrollTo(0, targetY);
      }, [y]);
      await delay(140);
      const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      const img = await loadImage(shot);
      ctx.drawImage(img, 0, Math.round(y * scale));
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
        await execute(tabId, () => {
          // Sticky elements are restored from the temporary marker added below when available.
          for (const el of document.querySelectorAll("[data-fpc-original-visibility]")) {
            el.style.visibility = el.getAttribute("data-fpc-original-visibility");
            el.removeAttribute("data-fpc-original-visibility");
          }
        });
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
  try {
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
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: capturedTitle + "-full-page." + extension,
      saveAs: true
    });
    setStatus("Export prepared. Choose where to save it in the download dialog.");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    setStatus(error?.message || "Export failed.");
  } finally {
    saveButton.disabled = false;
  }
});

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
