<div align="center">
  <img src="icons/wide_icon.webp" width="120" alt="FullPageCapture" />
</div>

# FullPageCapture

Capture an entire web page and export it as **PNG, JPEG, or PDF**. FullPageCapture scrolls through the page, stitches the visible sections together, and keeps the capture workflow in your browser.

## Features

- Full-page capture with progress feedback.
- PNG, JPEG, and single-page PDF export.
- Optional local Library for keeping captures inside the extension.
- Open saved captures in a full-page preview.
- Configurable filename pattern, save folder, and browser save dialog.
- Backup and restore for extension settings and saved capture data.
- No third-party runtime dependencies, analytics, or advertising.

## Browser support

The project targets **Google Chrome** and **Mozilla Firefox**. The packaging script creates a separate ZIP for each browser. Test each package in its target browser before distributing it; browser restrictions and API differences may affect capture or export behavior.

## Install for development

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the project folder.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on…**.
3. Choose the project's `manifest.json`.

Temporary Firefox add-ons are removed when Firefox closes. For regular use, install a signed release from the Firefox Add-ons site.

## Build release packages

The packaging script uses only Python's standard library. Python 3.9 or newer is required.

Run from the repository root:

```sh
python tools/package.py
```

This creates separate ZIP archives for Chrome and Firefox in `dist/`. To build only one browser:

```sh
python tools/package.py --browser chrome
python tools/package.py --browser firefox
```

The script validates the manifest and required files, creates clean browser-specific packages, and does not modify the source manifest. Generated files in `dist/` are build output, not source files.

## Permissions

- **activeTab**: access the active tab after you invoke the extension.
- **scripting**: inspect page dimensions and scroll the page during capture.
- **downloads**: export captures through the browser's download system.
- **storage**: store extension preferences locally.

Capture data and preferences are stored locally in the browser. See the [Privacy Policy](private-policy.md) for details.

## Notes and limitations

- Browser-internal pages, extension pages, some PDF viewers, protected content, and certain embedded cross-origin frames may not be capturable.
- Very large pages are limited to reduce the risk of exhausting browser memory.
- Lazy-loaded content, animations, complex nested scrollers, or pages that change during capture can produce imperfect results.
- Fixed and sticky elements may be temporarily hidden during capture to avoid repeated headers.
- Captures reflect what the browser can render and expose to the extension at capture time.

## Project status

FullPageCapture is under active development. Builds may contain bugs, unfinished details, or browser-specific limitations. Test packages before relying on them.

## License

MIT. See [LICENSE](LICENSE).
