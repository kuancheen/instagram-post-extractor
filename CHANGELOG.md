# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0 (Beta)] - 2026-02-11
### Added
- **FastDL Helper Workflow**: When proxy extraction fails, a guided card appears with 3-step instructions to extract images via [FastDL](https://fastdl.app).
- "Open FastDL" button pre-fills the Instagram URL for one-click access.
- Secondary URL input for pasting comma-separated image URLs from FastDL.
- "Load Images" button processes pasted URLs into the carousel viewer.
- `resolveFastDLUrl()` function that extracts Instagram CDN URLs from FastDL download links (`uri=` parameter), fixing the `Content-Disposition: attachment` issue that prevented inline display.
- Added `cdninstagram.com` to known image host detection patterns.

### Changed
- Proxy failure now triggers the FastDL helper instead of a generic error message.

## [0.0.1 (Beta)] - 2026-02-11
### Added
- Rebuilt web app from scratch with fresh codebase.
- Expanded CSS design system with custom properties (tokens for colors, spacing, radii, shadows, transitions).
- Premium glassmorphic dark-mode UI with animated gradient orbs.
- Semantic HTML structure with full `/new-project-init` compliance.
- Modular JavaScript with grouped DOM references, JSDoc comments, and clean section organization.
- Instagram post/reel metadata extraction via multi-proxy CORS engine (CodeTabs, AllOrigins, YACDN).
- Direct image URL support with auto-detection of common CDNs (Unsplash, Picsum, FastDL).
- Multi-image carousel with thumbnail navigation.
- OCR text extraction via Tesseract.js with live progress indicator.
- Proxy persistence via `localStorage` for faster repeat usage.
- Inline messaging system (zero pop-up policy).
- Standardized footer with version, README/CHANGELOG links, copyright, and Hits.sh badge.
- Responsive design with mobile-first breakpoints (768px, 480px).
- Cache busting on all internal CSS/JS links.
- Guided input placeholder text.

---

## Legacy

> The entries below are from the previous codebase iteration (v1.0.0–v1.1.0).

### [1.1.0] - 2026-02-11
#### Added
- Direct image URL support: Scan high-res images directly by pasting links.
- Carousel support: Extract and switch between multiple images from a single post.
- Multi-URL input: Support for comma or space separated URLs.

### [1.0.3] - 2026-02-11
#### Changed
- Prioritized successful proxies (CodeTabs, AllOrigins RAW).
- Implemented proxy persistence using `localStorage`.
- Increased retry delay to 3 seconds for better rate-limit recovery.

### [1.0.2] - 2026-02-11
#### Changed
- Expanded proxy rotation list (Added YACDN, refined AllOrigins RAW).
- Improved error handling and validation for proxy responses.
- Removed problematic ThingProxy due to DNS issues.

### [1.0.1] - 2026-02-11
#### Added
- "Enter" key trigger support for the URL input field.
- Expanded CORS proxy fallback list (ThingProxy, CodeTabs, AllOrigins Raw).
- Improved console logging for debugging proxy failures.

### [1.0.0] - 2026-02-11
#### Added
- Initial release of Instagram Post Extractor.
- Meta tag extraction for descriptions and images.
- Tesseract.js integration for OCR on post images.
- Glassmorphism UI design.
- Multi-proxy reliability engine (AllOrigins, CORSProxy.io, CodeTabs).
- Automatic retry and login page detection logic.
- Standardized documentation and structure.
