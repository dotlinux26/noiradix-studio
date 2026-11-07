# PIX2 Formal Grammar Specification v1.0

This document defines the formal lexical and syntactic grammar of the **PIX2 Sprite Description Language (`.pix2`)**.
Any conforming parser, serializer, or AI model MUST adhere to these rules.

---

## 1. Lexical Grammar

### 1.1 Character Encoding & Line Breaks
- Documents MUST be encoded in **UTF-8**.
- Line breaks may be either Unix (`\n` / LF) or Windows (`\r\n` / CRLF).
- Leading and trailing whitespace on lines is ignored by the parser.

### 1.2 Comments
PIX2 adopts strict comment parsing to eliminate conflicts with HEX color syntax `#RRGGBB`:

1. **Explicit Semicolon Comment (Preferred):**  
   The `;` character initiates an inline or line comment until the end of the line:
   ```pix2
   ; This is a comment
   1: #FFFFFF ; White palette color
   ```
2. **Whitespace-Guarded Hash Comment (Backward Compatible):**  
   A `#` character is parsed as a comment delimiter **ONLY IF**:
   - It is preceded by whitespace (or starts the line), **AND**
   - It is NOT followed by a valid 3, 4, 6, or 8-digit hexadecimal sequence.
   ```pix2
   # This is a full line comment
   pixel 7,12 #57546F # This trailing hash is a comment because preceded by whitespace
   ```

### 1.3 Identifiers & Literals
- **Identifiers** (`cell_id`, `anim_id`, `palette_name`): ASCII alphanumeric characters plus underscores: `[a-zA-Z_][a-zA-Z0-9_-]*`.
- **Strings**: Characters enclosed in double quotes: `"Player Walk Down"`. Escaped quotes `\"` are supported.
- **Integers**: Non-negative decimal numbers: `[0-9]+`.
- **Signed Integers**: Optional leading minus sign followed by non-negative integer: `-?[0-9]+`.
- **Dimensions**: `<width>x<height>` where width and height are integers: e.g. `16x16`, `32x32`.
- **Hex Colors**:
  - 3-digit RGB: `#RGB` (e.g. `#FFF` $\rightarrow$ `#FFFFFF`)
  - 4-digit RGBA: `#RGBA` (e.g. `#FFFF` $\rightarrow$ `#FFFFFFFF`)
  - 6-digit RRGGBB: `#RRGGBB` (e.g. `#57546F`)
  - 8-digit RRGGBBAA: `#RRGGBBAA` (e.g. `#57546F80` for 50% alpha)

---

## 2. Syntactic Grammar (EBNF)

```ebnf
PIX2Document       ::= FormatHeader MetaSection GridSection PaletteSection? CellSection* AnimationSection* EndMarker?

FormatHeader       ::= "@pix2" WS VersionNumber EOL
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

---

## 3. Semantic Validation Rules

1. **Unique Cell Identifiers**: Every `@cell <id>` must be globally unique within the document.
2. **Valid Coordinate Bounds**: Coordinates are parsed lexically as signed integers (`SignedInteger "," SignedInteger`). Semantically, for a cell with dimensions $W \times H$, every pixel coordinate $(x, y)$ must strictly satisfy:
   $$0 \le x < W \quad \text{and} \quad 0 \le y < H$$
   Any pixel outside this range (including negative offsets) must trigger a validation warning or diagnostic error (`PIX2_WARN_OUT_OF_BOUNDS`).
3. **Reference Integrity in Animations**: Every cell ID referenced in `@animation <id>` `frames: [...]` must exist in the `@cell` definitions of the document.
4. **Color Reference Resolution**: If a pixel references an identifier or integer (e.g. `pixel 5,8 outline`), that identifier must exist in the `@palette` section. If undefined, it falls back to parsing as direct hex or logs a semantic warning.
5. **Pure Transparency Guarantee**: A cell with zero pixel records is completely transparent. No pixel records may represent alpha zero (`#00000000`). If a pixel's alpha is zero, the record must be erased.
