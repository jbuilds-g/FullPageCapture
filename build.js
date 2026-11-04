const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = __dirname;
const dist = path.join(root, "dist");
const version = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
).version;

const files = [
  "popup.html",
  "popup.css",
  "popup.js",
  "settings.html",
  "settings.css",
  "settings.js",
  "library.html",
  "library.css",
  "library.js",
  "open.html",
  "open.js",
  "download.html",
  "download.js",
  "backup.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "icons/icon.webp",
  "icons/wide_icon.webp",
];

const browsers = [
  { name: "chrome", manifest: "manifest.json" },
  { name: "firefox", manifest: "manifest.firefox.json" },
];

function createArchive(output, archive) {
  fs.rmSync(archive, { force: true });

  if (process.platform === "win32") {
    const command =
      "$ErrorActionPreference = 'Stop'; " +
      "Add-Type -AssemblyName System.IO.Compression; " +
      "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
      "$stream = [System.IO.File]::Open($env:ARCHIVE_PATH, 'Create'); " +
      "try { " +
      "$zip = [System.IO.Compression.ZipArchive]::new($stream, 'Create'); " +
      "try { " +
      "Get-ChildItem -LiteralPath $env:PACKAGE_DIR -File -Recurse | ForEach-Object { " +
      "$entryName = $_.FullName.Substring($env:PACKAGE_DIR.Length).TrimStart([char]92, [char]47).Replace([char]92, [char]47); " +
      "[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName) | Out-Null " +
      "} " +
      "} finally { $zip.Dispose() } " +
      "} finally { $stream.Dispose() } " +
      "$check = [System.IO.Compression.ZipFile]::OpenRead($env:ARCHIVE_PATH); " +
      "try { if ($check.Entries.Count -eq 0) { throw 'Archive contains no files.' }; " +
      "if ($check.Entries.Name -contains '') { throw 'Archive contains an invalid entry.' } } " +
      "finally { $check.Dispose() }";

    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          PACKAGE_DIR: output,
          ARCHIVE_PATH: archive,
        },
      },
    );
  } else {
    execFileSync("zip", ["-r", archive, "."], {
      cwd: output,
      stdio: "inherit",
    });
    execFileSync("unzip", ["-Z1", archive], { stdio: "ignore" });
  }

  const stats = fs.statSync(archive);
  if (stats.size === 0) {
    throw new Error(`Archive is empty: ${path.basename(archive)}`);
  }
}

function copyPackage(browser) {
  const sourceManifest = path.join(root, browser.manifest);
  const output = path.join(dist, browser.name);

  if (!fs.existsSync(sourceManifest)) {
    throw new Error(`Missing ${browser.manifest}`);
  }

  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(sourceManifest, path.join(output, "manifest.json"));

  for (const file of files) {
    const source = path.join(root, file);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing package file: ${file}`);
    }
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  const archive = path.join(
    root,
    `FullPageCapture-${browser.name}-v${version}.zip`,
  );

  createArchive(output, archive);
  console.log(
    `Created ${path.basename(archive)} (${fs.statSync(archive).size} bytes)`,
  );
}

try {
  fs.rmSync(dist, { recursive: true, force: true });
  for (const browser of browsers) copyPackage(browser);
  console.log("Build complete.");
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(dist, { recursive: true, force: true });
}
