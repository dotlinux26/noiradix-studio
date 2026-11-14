# Third-Party Notices & Licenses

This file records third-party materials that are bundled with or loaded by the repository's web pages. Their licenses remain separate from the NOIRADIX project licenses. It is not a blanket license grant for every asset displayed by the website.

---

### 1. Font Awesome Free (v6.5.1)
* **Author / provider:** Fonticons, Inc. ([Font Awesome](https://fontawesome.com))
* **Used files:** `css/fontawesome/all.min.css` and `css/webfonts/fa-*.woff2` / `fa-brands-400.ttf`.
* **Licenses by material:** Icon artwork — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); webfonts — [SIL OFL 1.1](https://openfontlicense.org/); CSS/code — [MIT](https://opensource.org/license/mit/).
* **Attribution:** Font Awesome Free by Fonticons, Inc. See [Font Awesome's license information](https://fontawesome.com/license/free). The bundled stylesheet also retains its upstream attribution header.
* **Remote stylesheet:** `index.html` and `pixelart/index.html` load the local stylesheet and also request the Font Awesome 6.5.1 stylesheet from cdnjs. If the CDN request fails, the local stylesheet remains available. This makes an external request to cdnjs on page load; no Font Awesome JavaScript kit is used.

---

### 2. Runtime code and generated export templates
The editor's application logic has no required third-party JavaScript package dependency. It uses browser APIs and project-maintained JavaScript modules. This does not mean the hosted pages make no external requests: see the Font Awesome fallback above and the linked images below.
* **ZIP Archive Compiler:** Custom built-in client-side PKZIP generator and CRC-32 checksum algorithm (pure Vanilla ES6+, zero external JSZip binaries).
* **Color Models & Quantization:** Native mathematical color space transformations (HEX, RGB, RGBA, HSL, HSV, CIELAB Delta-E distance) implemented in pure JavaScript.
* **Canvas Rasterization:** Native HTML5 2D Canvas API with sub-pixel integer nearest-neighbor image rendering (`image-rendering: pixelated`).
* **Cross-Engine Export Templates:** Generated C# importer script (`Pix2UnityImporter.cs`), JSON metadata, and TexturePacker-compatible manifests are project templates covered by Apache-2.0, subject to their generated notices.

### 3. External images and badges
The Studio landing page references a GitHub profile image and badge images hosted by SourceForge, VibeCodePicks, TeaserTrack, AlternativeTo, SaaSCity, OpenHunts, Project Radar, and Product Hunt. These are requested from their respective hosts and are not bundled with this repository or relicensed by its LICENSE files. Their providers retain their own terms and privacy practices.

### 4. NOIRADIX and PIX2 license scope
* Application source code and project materials are covered by the root [Apache License 2.0](LICENSE), except where a file or the notices below state a different license.
* PIX2 specification text and the enumerated normative documentation are covered by [CC BY 4.0](pix2/LICENSE-SPEC); see [`NOTICE`](NOTICE) for the maintained file list.
* PIX2 reference implementation code is covered by [Apache-2.0](pix2/LICENSE-CODE).
* Third-party MIT, OFL, or CC BY notices apply only to the corresponding upstream material; they do not make the whole repository dual-licensed.
