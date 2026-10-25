# FullPageCapture

> FullPageCapture is a lightweight Chrome extension for capturing an entire web page and exporting it as PNG, JPEG, or PDF.

---

## Version 1.0.0

- Capture content below the visible viewport by scrolling through the page.
- Export the stitched capture as PNG, JPEG, or a single-page PDF.
- Use a compact popup with progress feedback and a save dialog.
- No third-party runtime dependencies.

---

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome or another Chromium-based browser.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository folder.
5. Open a normal website, select the extension, and click **Capture full page**.

---

## Notes and limitations

- This is an initial testing build. Test it on ordinary pages first.
- Browser-internal pages (such as `chrome://`), extension pages, some PDF viewers, protected content, and certain embedded cross-origin frames may not be capturable.
- Very large pages are capped to avoid exhausting browser memory.
- Lazy-loaded content may not always be fully loaded before capture. Animated content, complex nested scrollers, and pages that change while being captured can produce imperfect results.
- Fixed and sticky elements are temporarily hidden during capture to reduce repeated headers. The page is scrolled back by the browser after capture only if the user does so manually; the current build may leave the page at its last captured position.
- Firefox support is not included in this first build; the project is structured to add it after the Chrome capture flow is tested.

---

## Permissions

- `activeTab`: access the tab after the user invokes the extension.
- `scripting`: measure and scroll the active page.
- `downloads`: save the exported file.
  
---

> [!NOTE]
> The core logic and application code were generated with **AI** under my supervision and direction.

---

## License

MIT. See [LICENSE](LICENSE).
