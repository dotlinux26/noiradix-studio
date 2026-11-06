# PIX2 Specification v1.0
## Open Structured Sprite Description Language & Authoring Architecture

**Version:** 1.0.0  
**Status:** Official Reference Specification  
**Designated File Extension:** `.pix2`  
**MIME Type:** `application/x-pix2`  
**Project:** NOIRADIX Studio — AI-Native Structured Pixel Art Editor  
**Lead Architect:** dotlinux26 & Antigravity  

---

## 1. Executive Summary & Vision

Conventional pixel art tools treat sprites as raster bitmaps (flat 2D matrices of RGBA integers). When sprites are stored in PNG or GIF format, the semantic structure—such as which pixels belong to an eye, which cells represent walking frames, what color roles are assigned, and directional relationships—is completely lost.

Generative AI models attempting to produce pixel art via raster diffusion or latent prediction suffer from:
1. **Sub-pixel blur & color bleeding** (violating integer grid alignment).
2. **Inability to do surgical edits** (modifying a 2-pixel pupil regenerates the entire image).
3. **No semantic grounding** (the model cannot reliably reference "cell `down_0` at coordinate `(7, 12)`").

**PIX2 solves this by treating sprites as structured, addressable code.**  
In PIX2:
- `.pix2` is the single source of truth.
- PNG is merely an exported artifact.
- Sprites are stored as sparse pixel coordinate records: only explicitly drawn pixels exist.
- There is **no implicit background**. A missing pixel is always transparent.
- Any human or AI can read, parse, reason about, and mutate sprites using exact discrete mathematical coordinates:
  $$\text{Pixel Addressing: } \text{Player}.\text{cell\_id}.\text{pixel}(x, y) = \text{Color}$$

```
Human Designer ──┐
                 ├──▶  PIX2 Specification (.pix2)  ◀──▶  PIX2 Engine / Studio  ──▶  Lossless PNG / Atlas
AI Agent        ──┘     (Single Source of Truth)          (Canvas, Rulers, Timeline)
```

---

## 2. Fundamental Architectural Principles

### Principle 1: Sparse Pixel Storage
A pixel exists in storage if and only if it has an explicitly drawn, visible color record. Missing coordinates represent pure transparency. An application or parser MUST NEVER generate an implicit background canvas (such as solid white or black).

### Principle 2: Strict RGBA Color Fidelity
All color records support RGB and RGBA hex representations:
- `#RGB` (e.g. `#FFF` $\rightarrow$ `#FFFFFF`)
- `#RGBA` (e.g. `#FFFF` $\rightarrow$ `#FFFFFFFF`)
- `#RRGGBB` (e.g. `#57546F` $\rightarrow$ `#57546FFF`)
- `#RRGGBBAA` (e.g. `#57546F80` $\rightarrow$ $50\%$ semi-transparent outline)

The parser, serializer, and canvas renderer MUST preserve alpha channels between $0$ and $255$ without truncation.

### Principle 3: Three Independent Coordinate Systems
To avoid zoom, scaling, and display layout confusion, PIX2 strictly separates:

| Coordinate System | Type | Notation | Definition |
| :--- | :--- | :--- | :--- |
| **Cell Coordinates** | Integer | $(x, y) \in [0, W-1] \times [0, H-1]$ | Local pixel coordinate within a specific sprite cell. |
| **Sheet Coordinates** | Integer | $(X, Y) \in [0, \text{SheetW}-1] \times [0, \text{SheetH}-1]$ | Global pixel coordinate across the entire sprite atlas sheet. |
| **Screen Coordinates** | Float | $(x_s, y_s) \in \mathbb{R}^2$ | Physical client/CSS pixels on screen. Screen coordinates must **never** be stored in `.pix2`. |

Coordinate invariant:
$$\text{Zoom}(100\%) \rightarrow \text{Pixel}(7, 12) \equiv \text{Zoom}(1000\%) \rightarrow \text{Pixel}(7, 12)$$

### Principle 4: Decoupling of Identity from Grid Placement
A cell's identifier (`id`) must NOT be rigidly bound to grid row/column coordinates:
- `id`: Unique, immutable machine identifier (e.g. `down_0`, `ghost_idle_front`, `attack_slash_02`).
- `name`: User-facing display title (e.g. `"Down Idle Frame 0"`).
- `position`: Optional grid placement hint `(row, col)`.
- `direction`: Optional directional tag (`down`, `up`, `right`, `left`, `down_right`, etc.).
- `size`: Optional per-cell dimension override `WxH`.

### Principle 5: User-Defined Animations
The engine MUST NOT assume hardcoded rows (e.g., row 0 is down, row 1 is up). An animation sequence is an explicit named entity referencing an ordered array of cell IDs:
```
@animation walk_down
  direction: down
  frames: [down_0, down_1, down_2, down_3]
  fps: 6
  loop: true
```

---

## 3. PIX2 File Structure & Syntax Specification

A `.pix2` file is an UTF-8 plaintext document organized into directive sections starting with `@`.

```
Player.pix2
│
├── @pix2 1.0          (Format declaration)
├── @meta              (Document & project metadata)
├── @grid              (Sheet dimensions & default cell metrics)
├── @palette           (Color index table)
├── @cell <id>         (Cell declarations with sparse pixel records)
│   ├── name: "..."
│   ├── direction: ...
│   ├── frame: ...
│   ├── size: WxH
│   └── pixel x,y color
├── @animation <id>    (Animation state definitions)
└── @end               (Explicit end marker)
```

### 3.1 Lexer & Comment Disambiguation Rules
A major failure mode in naive parsers is confusing inline comments with hex color codes `#RRGGBB`.

PIX2 resolves this with two explicit grammar rules:
1. **Primary Comment Token:** The semicolon `;` is the official, unambiguous comment token. Any text following a `;` to the end of the line is a comment.
2. **Backward-Compatible `#` Token:** A `#` character is treated as a comment delimiter **ONLY IF** it is preceded by whitespace AND cannot be parsed as a valid hex color code (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`).

Example:
```
@palette
  1: #ffffff ; White body outline
  2: #57546f ; Ghost slate
  3: #ff6b8bcc # Semi-transparent blush (alpha CC)
```

### 3.2 Directives Specification

#### `@pix2 <version>`
Specifies the format version. Current version is `1.0`.

#### `@meta`
Contains key-value pairs defining project attributes:
- `title:` String name of the project.
- `author:` String name of the author.
- `version:` Document semantic revision.
- `color_mode:` `RGBA` (default) or `RGB`.
- `coordinate_origin:` `top-left` (mandatory for v1.0).

#### `@grid`
Defines sprite sheet layout:
- `columns:` Number of cell columns (integer $\ge 1$).
- `rows:` Number of cell rows (integer $\ge 1$).
- `default_cell:` Default width and height, e.g. `16x16`.
- `gap:` Inter-cell spacing in pixels (e.g. `1` for WISPLINGS `Player.png`).
- `margin:` Sheet border margin in pixels.

#### `@palette`
Defines named or indexed colors. AI and humans can use either palette IDs or direct hex codes in cell records:
```
@palette
  white: #ffffff
  outline: #57546f
  shade: #dde8ef
  blush: #ffb0bc80
```

#### `@cell <id>`
Defines a sprite frame.
Supported properties:
- `name: "<string>"`
- `direction: <dir_enum>` (`down`, `up`, `right`, `left`, `down_right`, `down_left`, `up_right`, `up_left`, `none`)
- `frame: <integer>`
- `size: <width>x<height>` (optional override of default cell size)
- `pixel <x>,<y> <palette_id | #hex>`
- Shorthand: `p <x>,<y> <palette_id | #hex>`

#### `@animation <id>`
Defines a sequence of frames:
- `name: "<string>"`
- `direction: <dir_enum>`
- `frames: [<cell_id_1>, <cell_id_2>, ...]`
- `fps: <integer>` (playback rate, e.g. 6)
- `loop: <boolean>` (`true` or `false`)
- `mode: <string>` (`loop`, `once`, `pingpong`)

#### `@end`
Signifies the deterministic end of the document.

---

## 4. Formal Grammar Summary

```ebnf
document          ::= format_header meta_section grid_section palette_section? cell_section* animation_section* end_marker
format_header     ::= "@pix2" WS version NL
meta_section      ::= "@meta" NL (meta_entry NL)+
grid_section      ::= "@grid" NL (grid_entry NL)+
palette_section   ::= "@palette" NL (palette_entry NL)+
cell_section      ::= "@cell" WS cell_id NL (cell_entry NL)*
animation_section ::= "@animation" WS anim_id NL (anim_entry NL)*
end_marker        ::= "@end" NL?

pixel_record      ::= ("pixel" | "p") WS coordinate WS color_reference
coordinate        ::= integer "," integer
color_reference   ::= palette_id | hex_color
hex_color         ::= "#" [0-9a-fA-F]{3,8}
```

---

## 5. Roundtrip Determinism & Data Integrity

A compliant implementation must satisfy the **Semantic Roundtrip Invariant**:
$$\text{Document } D_1 \xrightarrow{\text{Serialize}} S \xrightarrow{\text{Parse}} D_2 \implies D_1 \equiv_{\text{semantic}} D_2$$

Where $\equiv_{\text{semantic}}$ requires:
1. Identical pixel set: $\forall c \in \text{Cells}, \forall (x,y), D_1(c, x, y) = D_2(c, x, y)$ with exact RGBA equality.
2. Identical palette entries.
3. Identical cell names, dimensions, and direction tags.
4. Identical animation frame orderings, FPS, and loop modes.
5. Zero accidental background generation.
