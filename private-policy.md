# Privacy Policy

**Last updated:** November 3, 2026

FullPageCapture is a browser extension that captures full web pages and lets you export them as PNG, JPEG, or PDF files.

## Summary

- FullPageCapture does not send captured page content or personal information to a developer-controlled server.
- The extension does not include analytics, advertising, or telemetry.
- Capture data and settings are stored locally in your browser.
- The extension does not require an account.

## Information the Extension Accesses

When you start a capture, FullPageCapture accesses the active tab to measure and scroll the page and capture visible portions of it. This may include any information rendered on that page, including personal or sensitive information. Only capture pages you are authorized to access and save.

The extension temporarily changes the visibility of certain fixed or sticky page elements during capture to reduce repeated headers. It then attempts to restore their visibility and the page's previous scroll position.

## Local Storage

FullPageCapture uses browser-local storage for the following purposes:

- **Extension settings:** Preferences such as the default export format, filename pattern, save folder, save-dialog preference, and Library setting are stored using the browser's extension storage.
- **Library:** When the Library is enabled, new captures are saved in the extension's local IndexedDB database so you can view, export, or delete them from the Library. Disabling the Library prevents new captures from being added; it does not delete existing ones.
- **Capture preview:** The most recent capture prepared for opening is stored locally in IndexedDB so the extension's viewer can display it. This preview can remain in local browser storage after the popup closes and is replaced when another preview is saved.
- **Export fallback:** If the normal browser download flow is unavailable, temporary export data may be stored locally so the extension can open its fallback export page.
- **Backups:** If you create a backup, the extension creates a JSON file containing your settings and saved capture data. The file is saved through your browser and remains under your control.

This information is stored in the browser profile where the extension is installed. It is not uploaded by FullPageCapture. Local data may be removed if you clear the extension's site data, reset the browser profile, or uninstall the extension. Exported files and backup files remain wherever you saved them until you delete them.

## Exported Files

When you export a capture, FullPageCapture uses the browser's download functionality to save the file using your configured filename and folder preferences. The browser may show a save dialog depending on your settings. Exported files are subject to your browser's download settings and your device's file permissions.

## Permissions

FullPageCapture uses these permissions:

- **activeTab:** access the current tab after you invoke the extension.
- **scripting:** inspect page dimensions and scroll the page during capture.
- **downloads:** save exported files through the browser's download functionality.
- **storage:** save extension preferences locally.

These permissions support the extension's capture, settings, Library, and export workflows. Browser restrictions may prevent access to certain pages.

## Third-Party Services

FullPageCapture does not integrate analytics, advertising, or tracking services. It has no third-party runtime dependencies and does not transmit captured content to an external service.

The browser itself may handle downloads and extension installation or updates under its own privacy policies and settings.

## Data Security

FullPageCapture does not operate a remote account system or server-side database for user captures. Access to locally stored data is governed by the security of your browser profile and device. You are responsible for protecting exported captures and backup files, which may contain sensitive page content.

## Changes to This Policy

This policy may be updated if the extension's functionality or privacy practices change. Updates will be published in this repository.

## Contact

For questions or concerns, open an issue in the [FullPageCapture GitHub repository](https://github.com/jbuilds-g/FullPageCapture).

## Open Source

FullPageCapture is distributed under the MIT License. See [LICENSE](LICENSE).
