# Third-Party Notices & Licenses

NOIRADIX Studio incorporates third-party open-source assets and libraries under their respective permissive open-source licenses.

---

### 1. Font Awesome Free (v6.5.1)
* **Author / Provider:** Fonticons, Inc. (https://fontawesome.com)
* **License:**
  * Icons (SVG/PNG): [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
  * Fonts (WOFF2/TTF in `css/webfonts/`): [SIL Open Font License 1.1 (OFL-1.1)](http://scripts.sil.org/OFL)
  * Code (CSS/JS in `css/fontawesome/`): [MIT License](https://opensource.org/licenses/MIT)
* **Notice:**
  Font Awesome Free is free, open source, and GPL friendly. Used for user interface iconography across the desktop workbench, toolbar buttons, and status indicators.

---

### 2. Google Fonts: Inter
* **Author:** Rasmus Andersson (https://rsms.me/inter/)
* **License:** [SIL Open Font License, 1.1](http://scripts.sil.org/OFL)
* **Copyright:** Copyright (c) 2016-2024 The Inter Project Authors.

---

### 3. Google Fonts: JetBrains Mono
* **Author:** JetBrains (https://www.jetbrains.com/lp/mono/)
* **License:** [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)
* **Copyright:** Copyright 2020-2024 JetBrains s.r.o.

---

### 4. Zero External Runtime Dependencies Architecture
NOIRADIX Studio is deliberately engineered with **Zero External Runtime Dependencies**:
* **ZIP Archive Compiler:** Custom built-in client-side PKZIP generator and CRC-32 checksum algorithm (pure Vanilla ES6+, zero external JSZip binaries).
* **Color Models & Quantization:** Native mathematical color space transformations (HEX, RGB, RGBA, HSL, HSV, CIELAB Delta-E distance) implemented in pure JavaScript.
* **Canvas Rasterization:** Native HTML5 2D Canvas API with sub-pixel integer nearest-neighbor image rendering (`image-rendering: pixelated`).
* **Cross-Engine Export Templates:** Generated C# importer script (`Pix2UnityImporter.cs`), JSON metadata, and TexturePacker compatible manifests are self-contained templates licensed under Apache 2.0.

---

### 5. Project Copyright & License
All other source code, interface designs, format specifications (`.pix2`), and software architecture are copyright © 2026 **dotlinux26 (Nguyen Duc Canh)** and licensed under the **Apache License 2.0**.
