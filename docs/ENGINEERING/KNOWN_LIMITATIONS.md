# Known Limitations & Browser Boundary Constraints

## 1. Browser Sandbox & Filesystem Limits
- **Direct In-Place File Overwrite (`showOpenFilePicker`):**
  - Only supported in Chromium-based browsers (Chrome, Edge, Opera, Brave).
  - In Firefox, Safari, and mobile browsers, the application gracefully falls back to `<input type="file">` and download-triggered file saves.
- **Native Filesystem Watching:**
  - Standard browser security models prohibit standing file watchers on local disk files without an electron/desktop wrapper. File reloads require explicit user action or tab focus checks.

## 2. Canvas & Memory Boundaries
- **Maximum Sprite Sheet Canvas Size:**
  - HTML5 Canvas imposes maximum texture size limits depending on hardware and GPU (typically $4096 \times 4096$ or $8192 \times 8192$ pixels).
  - Noiradix Studio enforces a maximum document grid size of $64 \times 64$ cells to guarantee 60 FPS performance within a 25MB–100MB RAM budget.

## 3. GitHub Language Statistic Bar
- GitHub uses the `github/linguist` gem to calculate language percentages. Because `.pix2` is a newly formalized DSL, it does not yet appear in GitHub's official global `languages.yml` database. Repository badges and TextMate YAML grammar provide immediate syntax highlighting and branding.

## 4. AI Generator Parsing Nuances (Resolved in v2.1.1)
- **`rect` Primitive Dimension Delimiter:**
  - Resolved in v2.1.1: `parseDimension` now accepts both canonical `WxH` (e.g. `8x7`, `8X7`) and comma delimiter `W,H` (e.g. `8,7`), guaranteeing full compatibility with AI prompt generators and previous specification drafts.
- **Palette Inline Comment Characters:**
  - Resolved in v2.1.1: `@palette` parser and lexer disambiguate hexadecimal colors from inline comments (both `#` and `;` delimiters). Hex-like English words in comments (e.g. `#beef`, `#dead`, `#fade`, `#face`) are safely stripped without polluting palette color mappings.
  - See full root-cause analysis in [`AI_ARGON_PARSER_FEEDBACK_REPORT.md`](AI_ARGON_PARSER_FEEDBACK_REPORT.md).

