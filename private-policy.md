# Privacy Policy

**Last updated:** October 25, 2026

FullPageCapture is a browser extension that captures full web pages and lets you export them as PNG, JPEG, or PDF files.

## Information Collection

FullPageCapture does not collect, sell, or share personal information. It does not include analytics, advertising, or telemetry, and it does not send captured page content to a developer-controlled server.

## How the Extension Works

When you start a capture, the extension accesses the active tab to measure and scroll the page, temporarily adjusts the visibility of fixed or sticky elements where needed, and captures visible portions of the page. It assembles those portions in your browser and prepares the file you choose to export.

Captured page content is processed locally in your browser. The extension does not intentionally save captured content to its own storage or transmit it over the internet. When you export, the browser's download functionality saves the file to the location you choose.

A capture may contain anything visible on the page, including personal or sensitive information. Only capture pages you are authorized to access and save.

## Permissions

FullPageCapture requests these Chrome permissions:

- **activeTab**: access the current tab after you invoke the extension.
- **scripting**: inspect page dimensions and scroll the page during capture.
- **downloads**: save the exported file through the browser's download system.

The extension does not request broad access to all websites in its manifest. Browser restrictions may prevent capture on certain pages, such as browser-internal pages.

## Third-Party Services

FullPageCapture does not integrate third-party analytics, advertising, or tracking services and has no third-party runtime dependencies.

## Data Retention and Security

The extension does not maintain an account, remote database, or its own persistent collection of user data. Captured content and exported files may remain in your browser's memory or in the download location you select. You are responsible for protecting and deleting exported files as needed.

## Changes to This Policy

This policy may be updated if the extension's functionality or privacy practices change. Updates will be published in this repository.

## Contact

For questions or concerns about this policy, open an issue in the [FullPageCapture GitHub repository](https://github.com/jbuilds-g/FullPageCapture).

## Open Source

FullPageCapture is distributed under the MIT License. See [LICENSE](LICENSE).
