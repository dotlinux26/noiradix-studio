# PIX2 SPECIFICATION v1.0
## The AI-Native Pixel Art & Sprite Language

> **Document Version:** 1.0.0  
> **Target Audience:** AI Models (LLMs), Game Developers, Pixel Artists, Tool Authors  
> **Core Concept:** Human-readable & AI-writable text format representing 2D pixel art and sprite sheets with mathematical coordinate precision, zero diffusion hallucinations, and pure transparency by default.

---

## 1. Executive Summary & Why PIX2 Exists

Traditional image formats (`.png`, `.webp`, `.jpg`) are binary raster matrices. When generative AI attempts to create or modify pixel art through image generation diffusion models, it consistently fails with:
1. **Fuzzy sub-pixel blurring** and uneven pixel scales.
2. **Color bleed** and lack of a strict palette.
3. **Loss of transparency** (generating noisy gray/checkered backgrounds).
4. **Coordinate blindness** (inability to place eyes, weapons, or limbs at exact integer pixel offsets).

**PIX2 solves this** by treating pixel art as **Structured Data (Sprite as Structured Data - SaaD)** rather than an opaque raster matrix:
- **Text-Native & Git-Diffable:** A sprite sheet is a structured text file that LLMs and developers can read, reason about, edit, and version-control without Git LFS overhead.
- **Pure Transparency:** Only pixels with explicit color exist. If a coordinate is not listed, it is **100% transparent**. There is never an accidental background.
- **Deterministic Coordinate System:** Every pixel is anchored to an exact integer grid `(x, y)` with zero float rounding errors.
- **Hybrid Syntax:** Supports both high-level drawing primitives (`rect`, `line`, `fill`, `sym_dot`) for AI drafting, and dense coordinates (`p x,y id`) for exact editing.

### The 5 Architectural Pillars of PIX2:
1. **Deterministic Rendering:** Exact coordinates render identically across every platform and renderer with zero drift.
2. **Data-Level Editability:** Programmatic modifications at the coordinate, cell, or palette layer without manual pixel re-tracing.
3. **Modular Reusability:** Equipment overlays, skin swaps, and animation variations generated cleanly from base skeleton data.
4. **Ecosystem Interoperability:** Platform-agnostic text grammar easy to parse in Python, C#, Rust, and JavaScript.
5. **Git-Native Versionability:** Line-by-line diffs, pull request code review for art assets, and branchable sprite history.

---

## 2. Coordinate & Grid System Reference

### 2.1 The Coordinate Space
- **Origin `(0, 0)`** is located at the **TOP-LEFT** corner of each cell.
- **`X` axis** points horizontally to the **RIGHT** (`0` to `W - 1`).
- **`Y` axis** points vertically **DOWN** (`0` to `H - 1`).
- Lexically, coordinates accept signed integers (`SignedInteger "," SignedInteger`). Semantically, all rendered pixel coordinates must be non-negative integers satisfying $0 \le X < W$ and $0 \le Y < H$. Any coordinate outside this range triggers an out-of-bounds warning.

```
       X = 0      X = 1      ...      X = W-1
Y = 0  [0, 0]     [1, 0]              [W-1, 0]
Y = 1  [0, 1]     [1, 1]              [W-1, 1]
...
Y = H-1[0, H-1]   [1, H-1]            [W-1, H-1]
```

### 2.2 Standard Cell Dimensions
| Resolution | Total Pixels | Common Usage | Center Formula `(X, Y)` | Vertical Symmetry Axis |
| :--- | :--- | :--- | :--- | :--- |
| **16 × 16** | 256 px | Classic RPGs, Wisplings, Retro | `(7.5, 7.5)` | `X = 7.5` (between col 7 & 8) |
| **24 × 24** | 576 px | Detailed retro sprites, icons | `(11.5, 11.5)` | `X = 11.5` |
| **32 × 32** | 1,024 px | Modern pixel art, metroidvanias | `(15.5, 15.5)` | `X = 15.5` |
| **64 × 64** | 4,096 px | High-res pixel art, portraits | `(31.5, 31.5)` | `X = 31.5` |

### 2.3 Mathematical Formulas for AI Reasoning
- **Horizontal Mirroring (Flip H):**
  $$\text{mirrorX} = (\text{CellWidth} - 1) - x$$
  *Example (16×16):* If $x = 4$, $\text{mirrorX} = 15 - 4 = 11$.
- **Vertical Mirroring (Flip V):**
  $$\text{mirrorY} = (\text{CellHeight} - 1) - y$$
- **Centering Bounding Box:**
  If a drawn character spans from $x_{\min}$ to $x_{\max}$, its width is $w_{\text{box}} = x_{\max} - x_{\min} + 1$.  
  To center horizontally in a cell of width $W$:
  $$\Delta x = \left\lfloor \frac{W - w_{\text{box}}}{2} \right\rfloor - x_{\min}$$

---

## 3. PIX2 Language Grammar & Structure

A conforming `.pix2` file follows a deterministic section hierarchy:
1. `@pix2 <version>` — Mandatory format header (e.g. `@pix2 1.0`).
2. `@meta` — Document metadata (title, author, version, color_mode, coordinate_origin).
3. `@grid` — Layout parameters (columns, rows, default_cell / cell_size, gap, margin, background).
4. `@palette` (Optional) — Shorthand table mapping integer or string IDs to HEX colors.
5. `@cell <id>` (Zero or more) — Individual frame cells with drawing commands and sparse pixel maps.
6. `@animation <id>` (Zero or more) — Directional animation clips with frame lists, FPS, and loop modes.
7. `@end` (Optional) — Canonical document termination marker. Non-comment content after `@end` is prohibited.

### 3.1 Lexical Comment Rules
PIX2 adopts strict comment parsing to eliminate conflicts with HEX color syntax (`#RRGGBB`):
1. **Explicit Semicolon Comment (Preferred):**  
   The `;` character initiates an inline or line comment until the end of the line:
   ```pix2
   ; Full line comment
   1: #FFFFFF ; White palette color
   ```
2. **Whitespace-Guarded Hash Comment (Backward Compatible):**  
   A `#` character is treated as a comment delimiter **ONLY IF**:
   - It is preceded by whitespace or starts at column 0 of the line, **AND**
   - It is NOT followed by a valid 3, 4, 6, or 8-digit hexadecimal sequence.
   ```pix2
   # Full line comment
   pixel 7,12 #57546F # Trailing comment because preceded by space
   ```

### 3.2 Section: `@pix2` (Format Header)
Every PIX2 document MUST start with the format header specifying the language version:
```pix2
@pix2 1.0
```

### 3.3 Section: `@meta`
Contains global metadata about the sprite sheet:
```pix2
@meta
  title: "Player Wispling"
  author: "dotlinux26"
  version: "1.0"
  color_mode: "RGBA"
  coordinate_origin: "top-left"
```

### 3.4 Section: `@grid`
Defines the sheet layout and base cell resolution:
```pix2
@grid
  columns: 4
  rows: 4
  default_cell: 16x16
  gap: 0
  margin: 0
  background: none
```
- `columns` (or `cols`): Total columns in sprite atlas grid.
- `rows`: Total rows in sprite atlas grid.
- `default_cell` (or `cell_size`): Default `<width>x<height>` in pixels per cell.
- `gap`: Inter-cell padding in pixels (default: `0`).
- `margin`: Exterior sheet border margin in pixels (default: `0`).
- `background`: Canvas background rendering (`none` / `transparent`).

### 3.5 Section: `@palette` (Optional)
Maps integer IDs or string keys to 3, 4, 6, or 8-digit Hex colors:
```pix2
@palette
  1: #ffffff  ; Body White
  2: #57546f  ; Outline Dark Slate
  3: #dde8ef  ; Shade Light Blue
  shadow: #1e1b4b ; Dark Shadow
```
*Note:* Transparency is **never** added to the palette. Any coordinate not assigned a color is automatically fully transparent.

### 3.6 Section: `@cell <id>` (or `@frame <id>`)
Each cell defines a specific sprite or animation frame with optional metadata:
```pix2
@cell cell_0_0
  name: "Down 0"
  direction: down
  frame: 0
  grid_pos: 0,0
  size: 16x16
  p 4,0 2 p 5,0 2 p 6,0 2 p 7,0 2
```
- `grid_pos: <row>,<col>` binds decoupled cell IDs to a logical grid slot.
- `size: <w>x<h>` overrides `default_cell` dimensions for non-uniform cells.

### 3.7 Section: `@animation <id>` (Canonical Multi-Line)
Defines directional animation clips with frame sequences, playback speed, and loop mode:
```pix2
@animation walk_down
  name: "Walk Down"
  direction: down
  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]
  fps: 6
  loop: true
  mode: loop
```
- Properties:
  - `name: "<string>"` — Human-readable animation clip title.
  - `direction: <direction>` — Direction tag (`down`, `up`, `right`, `left`, `down_right`, `down_left`, `up_right`, `up_left`, `none`, `any`).
  - `frames: [<id>, ...]` — Ordered array of `@cell` identifiers.
  - `fps: <integer>` — Playback framerate (standard default: `6`–`8` FPS).
  - `loop: <boolean>` — `true` for continuous looping, `false` for one-shot action.
  - `mode: <string>` — `loop`, `once`, or `pingpong`.

*(Legacy block compatibility: Parsers also accept the single-line block format `@animations \n walk_down: [c0, c1] @ 6fps loop` for backward compatibility).*

---

## 4. Normative Specification of Drawing Primitives & Deterministic Rasterization

To guarantee that any compiler (Rust, Go, C++, Python, JavaScript) produces byte-for-byte identical pixel matrices, the rasterization behavior of all primitives is strictly standardized:

### 4.1 Evaluation Order & Last-Write-Wins (LWW) Policy
- All pixel records and vector commands within a `@cell` block MUST be evaluated in strict sequential document order (top-to-bottom, left-to-right).
- If multiple commands write to the same coordinate $(x, y)$, the later write overwrites any earlier write (**Last-Write-Wins**).

### 4.2 Pixel Primitives: `pixel`, `p`, `dot`, `d`
- **Syntax:** `p x,y <col>` or `pixel x,y <col>`
- **Semantics:** Plots a single discrete pixel at coordinate $(x, y)$ with color `<col>`.
- `<col>` may be an integer palette ID (e.g. `1`), an identifier key (e.g. `shadow`), or an inline `#HEX` code.

### 4.3 Line Primitive: `line` (Standard Integer Bresenham Algorithm)
- **Syntax:** `line x1,y1 x2,y2 <col>`
- **Algorithm:** All conforming implementations MUST use the canonical integer Bresenham algorithm with strict inequality tie-breaking:
  ```
  dx = abs(x2 - x1)
  dy = abs(y2 - y1)
  sx = x1 < x2 ? 1 : -1
  sy = y1 < y2 ? 1 : -1
  err = dx - dy
  while true:
    if 0 <= x1 < W and 0 <= y1 < H:
      plot(x1, y1, col)
    if x1 == x2 and y1 == y2: break
    e2 = 2 * err
    if e2 > -dy:
      err -= dy
      x1 += sx
    if e2 < dx:
      err += dx
      y1 += sy
  ```
- **Tie-Breaking Guarantee:** By evaluating `if (e2 > -dy)` followed by `if (e2 < dx)`, diagonal steps and octant transitions are handled identically across all language runtimes without floating-point rounding divergence. For example, `line 2,2 3,4` deterministically plots `(2,2) -> (2,3) -> (3,4)`. Pixels outside the cell bounds $[0..W-1, 0..H-1]$ are clipped.

### 4.4 Rectangle Primitive: `rect`
- **Syntax:** `rect x,y w,h <col> [outline|fill]`
- **Parameters:**
  - Origin $(x, y)$ is the inclusive top-left corner.
  - Dimensions $w \ge 1, h \ge 1$.
  - Mode: `outline` (default if omitted) or `fill`.
- **Bounding Box:** Covers coordinates $(x + dx, y + dy)$ where $0 \le dx < w$ and $0 \le dy < h$.
- **Semantics:**
  - `mode == "fill"`: Plots every coordinate $(x + dx, y + dy)$ for all $0 \le dx < w$ and $0 \le dy < h$.
  - `mode == "outline"`: Plots $(x + dx, y + dy)$ ONLY where $dx == 0$ OR $dx == w - 1$ OR $dy == 0$ OR $dy == h - 1$.
  - Any coordinate lying outside the cell bounds $[0..W-1, 0..H-1]$ is clipped.

### 4.5 Flood Fill Primitive: `fill`
- **Syntax:** `fill x,y <col>`
- **Neighborhood:** 4-connected (von Neumann neighborhood: cardinal directions up, down, left, right).
- **Semantics:**
  - Reads `targetColor = cell.pixels[(x, y)]` (or `undefined` / transparent).
  - If `targetColor == fillColor`, the command terminates immediately as a no-op.
  - Otherwise, replaces all 4-connected contiguous pixels matching `targetColor` with `fillColor`, bounded strictly by $[0..W-1, 0..H-1]$.

### 4.6 Bilateral Symmetry Primitive: `sym_dot`
- **Syntax:** `sym_dot x,y [axisX] <col>`
- **Parameters:**
  - Coordinate $(x, y)$ to plot.
  - `axisX` (float, optional): Reflection axis. If omitted, defaults to $(W - 1) / 2$ based on effective cell width $W$ (`cell.size.w` or `default_cell.w`, e.g. $7.5$ for $16\times 16$, $4.5$ for $10\times 10$).
- **Reflection Formula:**
  $$x_{\text{mirror}} = \text{round}(2 \times \text{axisX} - x)$$
- **Semantics:**
  1. If $0 \le x < W$ and $0 \le y < H$, plots $(x, y)$ with `<col>`.
  2. If $x_{\text{mirror}} \neq x$ and $0 \le x_{\text{mirror}} < W$ and $0 \le y < H$, plots $(x_{\text{mirror}}, y)$ with `<col>`.
  3. If $x_{\text{mirror}} == x$ (on the symmetry axis), it is plotted exactly once.
  4. Any coordinates outside $[0..W-1, 0..H-1]$ are clipped.

### 4.7 Conformance Resource Limits & Anti-DoS Bounds
To protect parser memory and prevent execution freezes under adversarial or astronomical input, all conforming implementations MUST enforce the following limits:
- **Maximum Coordinate Bound (`MAX_COORD_ABS` = 2048):** Any coordinate $(x, y)$ where $|x| > 2048$ or $|y| > 2048$ MUST be rejected from rasterization with a diagnostic error (`PIX2_ERR_RESOURCE_LIMIT`).
- **Maximum Line Steps (`MAX_BRESENHAM_STEPS` = 4096):** Bresenham line loops must terminate after at most 4096 steps.
- **Maximum Flood Fill Steps (`MAX_FLOOD_STEPS` = 65536):** Flood fill execution is capped at $\min(65536, 4 \times W \times H)$ iterations.
- **Rectangle Validation:** Dimensions must satisfy $w \ge 1, h \ge 1$. Rectangles with $w < 1$ or $h < 1$ must trigger `PIX2_ERR_INVALID_COORDINATE`. Mode must strictly be `outline` or `fill`; any other token must trigger `PIX2_ERR_INVALID_RECT_MODE`.

---

## 5. Complete Step-by-Step AI Instructions

When an LLM is asked to create or modify a `.pix2` character, it must follow this 6-step cognitive workflow:

### Step 1: Establish Palette & Silhouette
- Define a high-contrast palette:
  - 1 Outline color (darkest, e.g. `#2b2d42` or `#57546f`)
  - 1-2 Base/Skin colors (mid-tones, e.g. `#ffffff` or `#8ecae6`)
  - 1 Shadow/Shading color
  - 1 Feature/Accent color (eyes, cheeks, glowing core)

### Step 2: Respect Symmetrical Outlines
- For facing front/back (Down/Up directions), characters are usually symmetrical.
- Outline top dome on a 16×16 canvas:
  ```pix2
  # Top curve of head
  p 5,1 2 p 6,1 2 p 7,1 2 p 8,1 2 p 9,1 2 p 10,1 2
  # Left and right side walls
  p 3,2 2 p 4,2 1 ... p 11,2 1 p 12,2 2
  ```

### Step 3: Place Facial Features with Precision
- Eyes in a 16×16 sprite are typically 1×1 or 1×2 pixels placed between `Y = 6` and `Y = 8`.
- Left eye at `X = 5`, Right eye at `X = 10` (perfect 4-pixel spacing between eyes).
- Blinking frames: change eye pixel from pupil color to outline color or shift down by 1px!

### Step 4: Animation Sequencing (4-Frame Walk / Bob)
- **Frame 0 (Contact/Neutral):** Normal height.
- **Frame 1 (Pass/Bob Up):** Shift inner pixels up by 1 pixel (Y decreases by 1).
- **Frame 2 (Contact opposite):** Normal height with subtle limb/tail swap.
- **Frame 3 (Pass/Bob Down):** Shift bottom flare or blink.

---

## 6. Official Reference File: `Noiradix_Ghost.pix2` (Synthesized by Gemini 3.8 Flash)

The complete official sprite template [`samples/Noiradix_Ghost.pix2`](samples/Noiradix_Ghost.pix2) was **entirely authored and drawn by AI (Gemini 3.8 Flash)** using the `.pix2` deterministic specification. It implements 16 cells in a 4×4 grid with complete 4-directional locomotion:

```pix2
# ==============================================================================
# PIX2 SPRITE SPECIFICATION v1.0
# Reference Mascot: NOIRADIX Ghost (Synthesized by Gemini 3.8 Flash)
# ==============================================================================

@pix2 1.0

@meta
  title: "Noiradix Ghost"
  author: "Gemini 3.8 Flash & NOIRADIX Studio"
  version: "1.0"
  color_mode: "RGBA"
  coordinate_origin: "top-left"

@grid
  columns: 4
  rows: 4
  default_cell: 16x16
  background: none

@palette
  1: #57546f  ; Outline Slate
  2: #f8f7fb  ; Body Primary Ghost White
  3: #dde8ef  ; Shading Soft Blue
  4: #bfc9d9  ; Deep Shadow Slate
  5: #ffb0bc  ; Blush Cheeks Pink
  6: #ffd0d8  ; Soft Blush Highlight
  7: #48b8e8  ; Magic Sparkle Blue

@cell cell_0_0
  name: "Noiradix Down 0"
  direction: down
  frame: 0
  grid_pos: 0,0
  pixel 6,1 1 pixel 7,1 1 pixel 8,1 1 pixel 9,1 1 pixel 14,1 7
  pixel 5,2 1 pixel 6,2 2 pixel 7,2 2 pixel 8,2 2 pixel 9,2 2 pixel 10,2 1 pixel 13,2 7
  pixel 1,3 7 pixel 4,3 1 pixel 5,3 2 pixel 6,3 2 pixel 7,3 3 pixel 8,3 2 pixel 9,3 2 pixel 10,3 2 pixel 11,3 1
  pixel 2,4 7 pixel 3,4 1 pixel 4,4 2 pixel 5,4 2 pixel 6,4 2 pixel 7,4 2 pixel 8,4 3 pixel 9,4 2 pixel 10,4 2 pixel 11,4 2 pixel 12,4 1
  pixel 3,5 1 pixel 4,5 2 pixel 5,5 2 pixel 6,5 1 pixel 7,5 2 pixel 8,5 2 pixel 9,5 1 pixel 10,5 2 pixel 11,5 2 pixel 12,5 1
  pixel 3,6 1 pixel 4,6 5 pixel 5,6 2 pixel 6,6 1 pixel 7,6 2 pixel 8,6 2 pixel 9,6 1 pixel 10,6 2 pixel 11,6 5 pixel 12,6 1
  pixel 2,7 7 pixel 3,7 1 pixel 4,7 6 pixel 5,7 2 pixel 6,7 1 pixel 7,7 2 pixel 8,7 2 pixel 9,7 1 pixel 10,7 2 pixel 11,7 6 pixel 12,7 1 pixel 13,7 7
  pixel 1,8 1 pixel 2,8 2 pixel 3,8 1 pixel 4,8 2 pixel 5,8 2 pixel 6,8 2 pixel 7,8 2 pixel 8,8 2 pixel 9,8 2 pixel 10,8 2 pixel 11,8 2 pixel 12,8 1 pixel 13,8 2 pixel 14,8 1
  pixel 1,9 1 pixel 2,9 1 pixel 3,9 1 pixel 4,9 2 pixel 5,9 2 pixel 6,9 2 pixel 7,9 2 pixel 8,9 2 pixel 9,9 2 pixel 10,9 2 pixel 11,9 2 pixel 12,9 1 pixel 13,9 1 pixel 14,9 1
  pixel 2,10 1 pixel 3,10 2 pixel 4,10 2 pixel 5,10 2 pixel 6,10 2 pixel 7,10 2 pixel 8,10 2 pixel 9,10 2 pixel 10,10 2 pixel 11,10 2 pixel 12,10 2 pixel 13,10 1
  pixel 2,11 1 pixel 3,11 2 pixel 4,11 2 pixel 5,11 3 pixel 6,11 3 pixel 7,11 3 pixel 8,11 3 pixel 9,11 3 pixel 10,11 3 pixel 11,11 2 pixel 12,11 2 pixel 13,11 1
  pixel 2,12 1 pixel 3,12 3 pixel 4,12 3 pixel 5,12 3 pixel 6,12 4 pixel 7,12 4 pixel 8,12 4 pixel 9,12 4 pixel 10,12 3 pixel 11,12 3 pixel 12,12 3 pixel 13,12 1
  pixel 2,13 1 pixel 3,13 3 pixel 4,13 1 pixel 5,13 4 pixel 6,13 4 pixel 7,13 1 pixel 8,13 1 pixel 9,13 4 pixel 10,13 4 pixel 11,13 1 pixel 12,13 3 pixel 13,13 1
  pixel 3,14 1 pixel 6,14 1 pixel 9,14 1 pixel 12,14 1

@animation walk_down
  fps: 6
  loop: true
  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]

@animation walk_up
  fps: 6
  loop: true
  frames: [cell_1_0, cell_1_1, cell_1_2, cell_1_3]

@animation walk_right
  fps: 6
  loop: true
  frames: [cell_2_0, cell_2_1, cell_2_2, cell_2_3]

@animation walk_left
  fps: 6
  loop: true
  frames: [cell_3_0, cell_3_1, cell_3_2, cell_3_3]

@end
```

---

## 7. AI Prompt Template (Copy-Pasteable)

When feeding PIX2 tasks to an LLM, use this prompt structure:

```markdown
You are a precision pixel art system generating/editing sprites in the .pix2 format.
Rules:
1. ONLY return valid .pix2 syntax inside a ```pix2 code block.
2. Coordinate (0, 0) is top-left. Maximum bounds are (cellSize.w - 1, cellSize.h - 1).
3. NO background pixels. Only explicit drawn pixels exist.
4. Keep colors anchored to the @palette whenever possible.

CURRENT .PIX2 FILE:
[Insert .pix2 code here]

USER TASK:
[Insert request, e.g. "Add a wizard hat to row 0 frames", "Create 8-direction frames"]
```

---

## Appendix A: Formal EBNF Grammar & Directive Categorization

### Directive Categorization
* **Canonical Directives (v1.0 Standard):**
  - `@pix2 <version>` — Mandatory file header directive.
  - `@meta` — Document metadata section.
  - `@grid` — Layout atlas dimensions.
  - `@palette` — Indexed color palette.
  - `@cell <id>` — Frame pixel and primitive container.
  - `@animation <id>` — Multi-line directional animation clip.
  - `@end` — Explicit document termination marker.
* **Accepted Legacy Directives (Supported for backwards compatibility by readers):**
  - `@frame <id>` — Alias for `@cell <id>`.
  - `@animations` — Single-line legacy animations block (`name: [f1, f2] @ 6fps loop`).
* **Deprecated Directives:**
  - Emitting `@animations` blocks on serialize is deprecated; conforming serializers must emit canonical multi-line `@animation <id>` blocks.

### Formal EBNF Definition
```ebnf
PIX2Document       ::= FormatHeader MetaSection GridSection PaletteSection? CellSection* AnimationSection* EndMarker?

FormatHeader       ::= "@pix2" WS+ VersionNumber EOL
VersionNumber      ::= [0-9]+ "." [0-9]+

MetaSection        ::= "@meta" EOL (MetaEntry EOL)+
MetaEntry          ::= WS* Key ":" WS* Value
Key                ::= "title" | "author" | "version" | "type" | "color_mode" | "coordinate_origin" | Identifier
Value              ::= StringLiteral | Identifier

GridSection        ::= "@grid" EOL (GridEntry EOL)+
GridEntry          ::= WS* ("columns" | "cols") ":" WS* Integer
                     | WS* ("rows") ":" WS* Integer
                     | WS* ("default_cell" | "cell_size") ":" WS* Dimension
                     | WS* ("gap") ":" WS* Integer
                     | WS* ("margin") ":" WS* Integer
                     | WS* ("background") ":" WS* ("none" | "transparent")

PaletteSection     ::= "@palette" EOL (PaletteEntry EOL)+
PaletteEntry       ::= WS* (Identifier | Integer) ":" WS* HexColor (WS* Comment)?

CellSection        ::= ("@cell" | "@frame") WS+ Identifier EOL (CellProperty | PixelLine | VectorPrimitive)*
CellProperty       ::= WS* "name:" WS* StringLiteral EOL
                     | WS* "direction:" WS* DirectionEnum EOL
                     | WS* "frame:" WS* Integer EOL
                     | WS* "size:" WS* Dimension EOL
                     | WS* "grid_pos:" WS* Integer "," Integer EOL

DirectionEnum      ::= "down" | "up" | "right" | "left"
                     | "down_right" | "down_left" | "up_right" | "up_left"
                     | "none" | "any"

PixelLine          ::= WS* PixelRecord (WS+ PixelRecord)* (WS* Comment)? EOL
PixelRecord        ::= ("pixel" | "p") WS+ Coordinate WS+ ColorRef
                     | ("dot" | "d") WS+ Coordinate WS+ ColorRef
Coordinate         ::= SignedInteger "," SignedInteger
SignedInteger      ::= "-"? Integer
ColorRef           ::= HexColor | Identifier | Integer

VectorPrimitive    ::= LinePrimitive | RectPrimitive | FillPrimitive | SymDotPrimitive

LinePrimitive      ::= WS* "line" WS+ Coordinate WS+ Coordinate WS+ ColorRef EOL
RectPrimitive      ::= WS* "rect" WS+ Coordinate WS+ Dimension WS+ ColorRef (WS+ RectMode)? EOL
RectMode           ::= "outline" | "fill"
FillPrimitive      ::= WS* "fill" WS+ Coordinate WS+ ColorRef EOL
SymDotPrimitive    ::= WS* "sym_dot" WS+ Coordinate (WS+ Float)? WS+ ColorRef EOL
Float              ::= [0-9]+ ("." [0-9]+)?

AnimationSection   ::= "@animation" WS+ Identifier EOL (AnimProperty)*
                     | LegacyAnimationBlock
LegacyAnimationBlock ::= "@animations" EOL (WS* Identifier ":" WS* FrameList (WS* "@" WS* Integer "fps")? (WS* "loop" | "once")? EOL)*
AnimProperty       ::= WS* "name:" WS* StringLiteral EOL
                     | WS* "direction:" WS* DirectionEnum EOL
                     | WS* "frames:" WS* FrameList EOL
                     | WS* "fps:" WS* Integer EOL
                     | WS* "loop:" WS* Boolean EOL
                     | WS* "mode:" WS* ("loop" | "once" | "pingpong") EOL

FrameList          ::= "[" WS* (Identifier (WS* "," WS* Identifier)*)? WS* "]"
Boolean            ::= "true" | "false"
Dimension          ::= Integer "x" Integer

EndMarker          ::= "@end" EOL?
```
