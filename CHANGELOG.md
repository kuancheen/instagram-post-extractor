# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-11
### Added
- Direct image URL support: Scan high-res images directly by pasting links.
- Carousel support: Extract and switch between multiple images from a single post.
- Multi-URL input: Support for comma or space separated URLs.

## [1.0.3] - 2026-02-11
### Changed
- Prioritized successful proxies (CodeTabs, AllOrigins RAW).
- Implemented proxy persistence using `localStorage`.
- Increased retry delay to 3 seconds for better rate-limit recovery.

## [1.0.2] - 2026-02-11
### Changed
- Expanded proxy rotation list (Added YACDN, refined AllOrigins RAW).
- Improved error handling and validation for proxy responses.
- Removed problematic ThingProxy due to DNS issues.

## [1.0.1] - 2026-02-11
### Added
- "Enter" key trigger support for the URL input field.
- Expanded CORS proxy fallback list (ThingProxy, CodeTabs, AllOrigins Raw).
- Improved console logging for debugging proxy failures.

## [1.0.0] - 2026-02-11
### Added
- Initial release of Instagram Post Extractor.
- Meta tag extraction for descriptions and images.
- Tesseract.js integration for OCR on post images.
- Glassmorphism UI design.
- Multi-proxy reliability engine (AllOrigins, CORSProxy.io, CodeTabs).
- Automatic retry and login page detection logic.
- Standardized documentation and structure.
