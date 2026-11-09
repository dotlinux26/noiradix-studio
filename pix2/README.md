# PIX2: The Structured Pixel Art Language

> **Sprite-as-Structured-Data (SaaD) Standard Specification & Reference Engine**  
> *Created & Architected by **Nguyen Duc Canh** ([@dotlinux26](https://github.com/dotlinux26))*

---

[Normative PIX2 1.1 specification](../PIX2_SPECIFICATION.md) · [Historical PIX2 1.0 reference](SPECIFICATION.md)

## 1. Overview & Vision

**PIX2** is an open, human-readable, deterministic Domain Specific Language (DSL) engineered specifically for defining 2D pixel art spritesheets, character cell atlases, palettes, and multi-directional animations as pure structured data.

Unlike raster image formats (PNG, WebP) which store unstructured pixel matrices without semantic awareness, PIX2 treats artwork as an editable, versionable document graph:
- **Deterministic Rendering**: Identical inputs with conforming renderers yield identical pixel outputs.
- **Data-Level Editability**: Coordinates, palettes, frames, and geometric macros are discrete records.
- **Git-Native Versionability**: Line-oriented text enables transparent diffing, branching, and automated PR review of game graphics.
- **AI-Native Authoring**: Large Language Models (LLMs) can reliably reason about coordinates and geometry far more accurately than generating raw uncompressed bytes.

---

## 2. Independence & Ecosystem Governance

While **NOIRADIX Studio** serves as the initial reference visual editor and suite for PIX2, **PIX2 is governed as an independent standard**. Any engine, game framework, or toolchain (Unity, Godot, Unreal, Aseprite plugins, CLI compilers) can implement conforming parsers and renderers without dependency on NOIRADIX Studio.

### Project Layout

```
pix2/
├── README.md               # Standard overview & creator accreditation
├── SPECIFICATION.md        # Historical language specification v1.0
├── LICENSE-CODE            # Apache-2.0 for reference code & compiler
├── LICENSE-SPEC            # CC BY 4.0 for specifications & documentation
├── js/                     # Canonical JavaScript compiler/parser implementation
│   └── pix2-format.js      # Reference engine (PIX2.parse, serialize, validate)
└── test-vectors/           # Normative conformance test vectors for 3rd-party ports
    ├── README.md           # Conformance testing guidelines
    ├── canonical_valid_hero.pix2
    ├── canonical_valid_hero.json
    ├── invalid_syntax_coordinate.pix2
    ├── invalid_missing_frame.pix2
    └── invalid_out_of_bounds.pix2
```

---

## 3. Reference Implementation & Ports

The reference implementation of the PIX2 parser, serializer, and validation engine is provided in JavaScript (`pix2/js/pix2-format.js`).

Developers implementing PIX2 in **Rust, Python, Go, C#, C++, or Zig** must validate their implementations against the normative test vectors located in `pix2/test-vectors/`.

---

## 4. Licensing & Attribution

PIX2 utilizes a clean dual-licensing model to protect both the standard's open dissemination and the implementation's commercial usability:

- **Specification & Documentation**: Licensed under **Creative Commons Attribution 4.0 International ([CC BY 4.0](LICENSE-SPEC))**.
  - Attribution requirement: *PIX2 Specification created by Nguyen Duc Canh (@dotlinux26).*
- **Reference Compiler & Code**: Licensed under the **Apache License, Version 2.0 ([Apache-2.0](LICENSE-CODE))**.
  - Free for commercial, personal, open-source, and proprietary integration.

---

## 5. Creator Accreditation

- **Standard Designer & Architect**: Nguyen Duc Canh ([@dotlinux26](https://github.com/dotlinux26))
- **Reference Engine Author**: Nguyen Duc Canh ([@dotlinux26](https://github.com/dotlinux26))
