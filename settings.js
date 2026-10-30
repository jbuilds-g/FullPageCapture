const defaults = { defaultFormat: "png", filenamePattern: "{title}-full-page", saveFolder: "FullPageCapture", showSaveDialog: false, libraryEnabled: false };
const format = document.querySelector("#default-format");
const pattern = document.querySelector("#filename-pattern");
const folder = document.querySelector("#save-folder");
const saveDialog = document.querySelector("#show-save-dialog");
const libraryEnabled = document.querySelector("#library-enabled");
const status = document.querySelector("#settings-status");
const saveButton = document.querySelector("#save-settings");

async function initialize() {
  const settings = { ...defaults, ...(await chrome.storage.local.get(defaults)) };
  format.value = settings.defaultFormat;
  pattern.value = settings.filenamePattern;
  folder.value = settings.saveFolder;
  saveDialog.checked = Boolean(settings.showSaveDialog);
  libraryEnabled.checked = Boolean(settings.libraryEnabled);
}

saveButton.addEventListener("click", async () => {
  const filenamePattern = pattern.value.trim() || defaults.filenamePattern;
  const saveFolder = folder.value.trim().replace(/\\/g, "/").split("/").filter(part => part && part !== "." && part !== "..").join("/");
  saveButton.disabled = true;
  try {
    await chrome.storage.local.set({
      defaultFormat: format.value,
      filenamePattern,
      saveFolder,
      showSaveDialog: saveDialog.checked,
      libraryEnabled: libraryEnabled.checked
    });
    status.textContent = "Settings saved.";
  } catch (error) {
    status.textContent = "Could not save settings. " + (error?.message || "");
  } finally {
    saveButton.disabled = false;
  }
});

initialize().catch(error => { status.textContent = "Could not load settings. " + (error?.message || ""); });
