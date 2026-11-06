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

**PIX2 solves this** by treating pixel art as a **Domain-Specific Language (DSL)**:
- **Text-Native:** A sprite sheet is just a structured text file that any LLM can read, reason about, edit, and generate.
- **Pure Transparency:** Only pixels with explicit color exist. If a coordinate is not listed, it is **100% transparent**. There is never a background.
- **Deterministic Coordinate System:** Every pixel is anchored to an exact integer grid `(x, y)`.
- **Hybrid Syntax:** Supports both high-level drawing primitives (`rect`, `line`, `fill`, `sym_dot`) for AI drafting, and dense coordinates (`p x,y id`) for exact editing.

---

## 2. Coordinate & Grid System Reference

### 2.1 The Coordinate Space
- **Origin `(0, 0)`** is located at the **TOP-LEFT** corner of each cell.
- **`X` axis** points horizontally to the **RIGHT** (`0` to `W - 1`).
- **`Y` axis** points vertically **DOWN** (`0` to `H - 1`).
- All coordinates must be non-negative integers.

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

A `.pix2` file consists of 4 primary sections:
1. `@meta` — Sheet metadata, grid dimensions, and resolution.
2. `@palette` — Indexed shorthand color table.
3. `@animations` — Animation states, frame sequences, FPS, and loop modes.
4. `@cell <id>` — Individual frames containing drawn pixels and commands.

Comments start with `#` and can appear anywhere.

### 3.1 Section: `@meta`
```pix2
@meta
  title: "Player Wispling"
  author: "dotlinux26"
  version: "1.0"
  grid: 4x4
  cell_size: 16x16
```
- `grid`: `<cols>x<rows>` (e.g. `4x4` = 16 cells, `8x4` = 32 cells).
- `cell_size`: `<width>x<height>` in pixels per cell.

### 3.2 Section: `@palette`
Maps integer IDs to 6-character or 8-character Hex colors:
```pix2
@palette
  1: #ffffff  # Body White
  2: #57546f  # Outline Dark Slate
  3: #dde8ef  # Shade Light Blue
  4: #ffb0bc  # Blush Pink
  5: #46435c  # Pupil Dark Purple
```
*Note:* Transparency is **never** added to the palette. Any coordinate not assigned a color is automatically fully transparent.

### 3.3 Section: `@animations`
Defines playback clips for 4-direction and 8-direction animation controllers:
```pix2
@animations
  walk_down:  [cell_0_0, cell_0_1, cell_0_2, cell_0_3] @ 6fps loop
  walk_up:    [cell_1_0, cell_1_1, cell_1_2, cell_1_3] @ 6fps loop
  walk_right: [cell_2_0, cell_2_1, cell_2_2, cell_2_3] @ 6fps loop
  walk_left:  [cell_3_0, cell_3_1, cell_3_2, cell_3_3] @ 6fps loop
```
- Syntax: `<name>: [<cell_id>, ...] @ <speed>fps [loop|once]`
- Standard Direction Names:
  - **4-Direction:** `down`, `up`, `right`, `left`
  - **8-Direction:** `down`, `down_right`, `right`, `up_right`, `up`, `up_left`, `left`, `down_left`

### 3.4 Section: `@cell <id>`
Each cell defines a specific sprite or animation frame:
```pix2
@cell cell_0_0
  name: "Down 0"
  p 4,0 2 p 5,0 2 p 6,0 2 p 7,0 2 p 8,0 2 p 9,0 2 p 10,0 2 p 11,0 2
  p 3,1 2 p 4,1 1 p 5,1 1 p 6,1 1 p 7,1 1 p 8,1 1 p 9,1 1 p 10,1 1 p 11,1 1 p 12,1 2
```

---

## 4. Drawing Commands & Primitives (For AI Generation)

When an AI drafts or modifies a cell, it can write **either** sparse coordinates or high-level drawing primitives. The PIX2 parser evaluates them sequentially:

| Command | Syntax | Description | Example |
| :--- | :--- | :--- | :--- |
| **Plot Pixel** | `p x,y <col>` | Sets single pixel at `(x, y)` | `p 7,8 5` |
| **Dot** | `dot x,y <col>` | Synonym for single pixel | `dot 7,8 #ffffff` |
| **Line** | `line x1,y1 x2,y2 <col>` | Bresenham straight line | `line 2,2 13,2 2` |
| **Rectangle** | `rect x,y w,h <col> [mode]` | Box (`outline` or `fill`) | `rect 3,2 10,12 1 fill` |
| **Flood Fill** | `fill x,y <col>` | 4-way flood fill contiguous area | `fill 7,7 1` |
| **Symmetric Dot** | `sym_dot x,y axisX <col>` | Plots `(x,y)` and mirrors across axis | `sym_dot 4,7 7.5 5` |

`<col>` can be an integer palette ID (e.g. `1`, `2`) or a direct hex color (e.g. `#ffffff`).

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

## 6. Official Reference File: `Player.pix2`

```pix2
# ==============================================================================
# PIX2 SPRITE SPECIFICATION v1.0
# Sprite Sheet: Player (Wispling Ghost)
# ==============================================================================

@meta
  title: "Player Wispling"
  author: "dotlinux26"
  version: "1.0"
  grid: 4x4
  cell_size: 16x16

@palette
  1: #ffffff  # Body White
  2: #57546f  # Outline Dark Slate
  3: #dde8ef  # Shade Light Blue
  4: #ffb0bc  # Blush Pink
  5: #46435c  # Eye Dark Purple

@animations
  walk_down:  [cell_0_0, cell_0_1, cell_0_2, cell_0_3] @ 6fps loop
  walk_up:    [cell_1_0, cell_1_1, cell_1_2, cell_1_3] @ 6fps loop
  walk_right: [cell_2_0, cell_2_1, cell_2_2, cell_2_3] @ 6fps loop
  walk_left:  [cell_3_0, cell_3_1, cell_3_2, cell_3_3] @ 6fps loop

@cell cell_0_0
  name: "Down 0"
  p 4,0 2 p 5,0 2 p 6,0 2 p 7,0 2 p 8,0 2 p 9,0 2 p 10,0 2 p 11,0 2
  p 3,1 2 p 4,1 1 p 5,1 1 p 6,1 1 p 7,1 1 p 8,1 1 p 9,1 1 p 10,1 1 p 11,1 1 p 12,1 2
  p 2,2 2 p 3,2 1 p 4,2 1 p 5,2 1 p 6,2 1 p 7,2 1 p 8,2 1 p 9,2 1 p 10,2 1 p 11,2 1 p 12,2 1 p 13,2 2
  p 2,3 2 p 3,3 1 p 4,3 1 p 5,3 1 p 6,3 1 p 7,3 1 p 8,3 1 p 9,3 1 p 10,3 1 p 11,3 1 p 12,3 1 p 13,3 2
  p 2,4 2 p 3,4 1 p 4,4 1 p 5,4 1 p 6,4 1 p 7,4 1 p 8,4 1 p 9,4 1 p 10,4 1 p 11,4 1 p 12,4 1 p 13,4 2
  p 2,5 2 p 3,5 1 p 4,5 1 p 5,5 1 p 6,5 1 p 7,5 1 p 8,5 1 p 9,5 1 p 10,5 1 p 11,5 1 p 12,5 1 p 13,5 2
  p 2,6 2 p 3,6 1 p 4,6 1 p 5,6 1 p 6,6 1 p 7,6 1 p 8,6 1 p 9,6 1 p 10,6 1 p 11,6 1 p 12,6 1 p 13,6 2
  p 2,7 2 p 3,7 1 p 4,7 1 p 5,7 5 p 6,7 1 p 7,7 1 p 8,7 1 p 9,7 1 p 10,7 5 p 11,7 1 p 12,7 1 p 13,7 2
  p 2,8 2 p 3,8 1 p 4,8 1 p 5,8 2 p 6,8 1 p 7,8 1 p 8,8 1 p 9,8 1 p 10,8 2 p 11,8 1 p 12,8 1 p 13,8 2
  p 2,9 2 p 3,9 4 p 4,9 4 p 5,9 1 p 6,9 1 p 7,9 1 p 8,9 1 p 9,9 1 p 10,9 1 p 11,9 4 p 12,9 4 p 13,9 2
  p 3,10 2 p 4,10 1 p 5,10 1 p 6,10 1 p 7,10 1 p 8,10 1 p 9,10 1 p 10,10 1 p 11,10 1 p 12,10 2
  p 4,11 2 p 5,11 2 p 6,11 1 p 7,11 1 p 8,11 1 p 9,11 1 p 10,11 2 p 11,11 2
  p 5,12 2 p 6,12 1 p 7,12 1 p 8,12 1 p 9,12 1 p 10,12 2
  p 3,13 2 p 5,13 2 p 6,13 3 p 7,13 3 p 8,13 3 p 9,13 3 p 10,13 2 p 12,13 2
  p 5,14 2 p 6,14 3 p 7,14 2 p 8,14 2 p 9,14 3 p 10,14 2
  p 6,15 2 p 9,15 2
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
