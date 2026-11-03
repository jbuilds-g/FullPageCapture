#!/usr/bin/env python3
"""Build clean Chrome and Firefox ZIP packages for FullPageCapture."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Explicit allowlist: source files only. Build output and repository metadata
# are intentionally excluded from release archives.
FILES = (
    "README.md",
    "LICENSE",
    "private-policy.md",
    "manifest.json",
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
)


def load_manifest() -> dict:
    path = ROOT / "manifest.json"
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read manifest.json: {exc}") from exc

    if manifest.get("manifest_version") != 3:
        raise ValueError("Only Manifest V3 is supported by this packager.")
    for key in ("name", "version", "permissions", "action", "icons"):
        if key not in manifest:
            raise ValueError(f"manifest.json is missing required key: {key}")
    if not isinstance(manifest["version"], str):
        raise ValueError("The manifest version must be a string.")
    return manifest


def package_files(manifest: dict) -> list[str]:
    files = list(FILES)
    action = manifest.get("action", {})
    options = manifest.get("options_ui", {})

    for candidate in (
        action.get("default_popup"),
        options.get("page"),
    ):
        if candidate and candidate not in files:
            files.append(candidate)

    for icon in manifest.get("icons", {}).values():
        if icon not in files:
            files.append(icon)
    for icon in action.get("default_icon", {}).values():
        if icon not in files:
            files.append(icon)

    missing = [name for name in files if not (ROOT / name).is_file()]
    if missing:
        raise ValueError("Required package files are missing:\n  " + "\n  ".join(missing))
    return sorted(set(files))


def build(browser: str, output_dir: Path, manifest: dict, files: list[str]) -> Path:
    release_manifest = dict(manifest)

    # Chrome-only metadata is not meaningful to Firefox.
    if browser == "firefox":
        release_manifest.pop("minimum_chrome_version", None)

    version = release_manifest["version"]
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"FullPageCapture-{version}-{browser}.zip"

    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.writestr(
            "manifest.json",
            json.dumps(release_manifest, indent=2, ensure_ascii=False) + "\n",
        )
        for name in files:
            if name == "manifest.json":
                continue
            zf.write(ROOT / name, name)

    # Re-open and validate the generated archive rather than trusting the write.
    with zipfile.ZipFile(archive, "r") as zf:
        names = set(zf.namelist())
        if "manifest.json" not in names:
            raise ValueError(f"{archive.name}: manifest.json is missing.")
        packaged_manifest = json.loads(zf.read("manifest.json"))
        if packaged_manifest.get("manifest_version") != 3:
            raise ValueError(f"{archive.name}: invalid manifest version.")
        missing_references = [
            value
            for value in (
                packaged_manifest.get("action", {}).get("default_popup"),
                packaged_manifest.get("options_ui", {}).get("page"),
                *packaged_manifest.get("icons", {}).values(),
                *packaged_manifest.get("action", {}).get("default_icon", {}).values(),
            )
            if value and value not in names
        ]
        if missing_references:
            raise ValueError(
                f"{archive.name}: manifest references missing files: "
                + ", ".join(missing_references)
            )
    return archive


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build clean Chrome and Firefox ZIP packages."
    )
    parser.add_argument(
        "--browser",
        choices=("chrome", "firefox", "all"),
        default="all",
        help="Browser package to build (default: all).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "dist",
        help="Output directory (default: ./dist).",
    )
    args = parser.parse_args()

    try:
        manifest = load_manifest()
        files = package_files(manifest)
        browsers = ("chrome", "firefox") if args.browser == "all" else (args.browser,)
        for browser in browsers:
            archive = build(browser, args.output_dir.resolve(), manifest, files)
            print(f"Created {archive} ({archive.stat().st_size:,} bytes)")
        print(f"Included {len(files) + 1} files per package.")
        return 0
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        print(f"Packaging failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
