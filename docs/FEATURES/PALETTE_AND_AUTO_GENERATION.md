# Palette Management & Auto-Generation Specification

## 1. Overview
The **Generate from Artwork** engine extracts palettes directly from drawn pixels, eliminating the need to manually enter hexadecimal colors.

## 2. Extraction Pipeline

```
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │  Source Scope   │ ───>  │  Pixel Scanner  │ ───>  │  Deduplication  │
  │ (Active / Sheet)│       │ (Exclude Alpha0)│       │ & Frequency Map │
  └─────────────────┘       └─────────────────┘       └─────────────────┘
                                                               │
                                                               ▼
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │ Apply Action    │ <───  │ Preview Swatches│ <───  │  Sort / Reduce  │
  │ (Add / Replace) │       │ & Tooltips      │       │ (Exact / Top N) │
  └─────────────────┘       └─────────────────┘       └─────────────────┘
```

## 3. Configuration & Options
- **Source Scope:**
  - `Active Cell`: Analyzes only the active frame.
  - `Entire Document`: Scans all painted cells across all rows.
- **Extraction Modes:**
  - `Exact Colors`: Extracts every unique RGBA color, sorted by pixel frequency descending.
  - `Reduce Colors`: Quantizes the extracted palette to the Top $N$ colors (between 2 and 64).
- **Application Modes:**
  - `Add to Palette`: Preserves existing palette entries, appending missing colors to the next available indices.
  - `Replace Palette`: Atomically updates `@palette` with detected colors and remaps existing cell pixels.
- **Undo/Redo Guarantee:** Applying a generated palette is recorded as a single snapshot in the history stack.
