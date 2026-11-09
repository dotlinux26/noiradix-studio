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

## 4. AI Generator Parsing Nuances (Field Observation by Gemini Argon 4.0)
- **`rect` Primitive Dimension Delimiter:**
  - `parseDimension` strictly expects `WxH` (separated by `x`, e.g. `8x7`). Using comma separators (`8,7`) in `rect` commands causes coordinate rejection. AI models are advised to use Scanline Rendering (`line x1,y x2,y <col>`) or strict `WxH` format.
- **Palette Inline Comment Characters:**
  - In `@palette`, semicolon `;` is strongly recommended over `#` for inline comments to avoid lexical collision with hexadecimal color codes.
  - See full root-cause analysis in [`AI_ARGON_PARSER_FEEDBACK_REPORT.md`](AI_ARGON_PARSER_FEEDBACK_REPORT.md).

