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
  "private-policy.md",
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

  if (process.platform === "win32") {
    execFileSync("tar", ["-a", "-c", "-f", archive, "-C", output, "."], {
      stdio: "inherit",
    });
  } else {
    execFileSync("zip", ["-r", archive, "."], {
      cwd: output,
      stdio: "inherit",
    });
  }

  console.log(`Created ${path.basename(archive)}`);
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
