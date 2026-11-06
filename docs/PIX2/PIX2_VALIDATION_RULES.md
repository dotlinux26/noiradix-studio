# PIX2 Validation Rules & Diagnostic Error Matrix

## 1. Syntax & Structural Constraints
1. **Header Requirement:** Must begin with `@pix2 <version>` (e.g. `@pix2 1.0`).
2. **Prototype Pollution Protection:**
   - Any directive key, identifier, or palette index matching `__proto__`, `constructor`, or `prototype` is strictly rejected and scrubbed during lexing.
3. **Safety Coordinate Boundaries:**
   - Dimensions clamped to maximum `2048 × 2048` to protect against Denial-of-Service (DoS) and RAM exhaustion attacks.
   - Coordinates outside $[-2048, 2048]$ are flagged as illegal.

## 2. Color & Palette Integrity
- **Hex Code Formats:**
  - 3-character RGB: `#RGB` (normalized to `#RRGGBB`).
  - 6-character RGB: `#RRGGBB`.
  - 8-character RGBA: `#RRGGBBAA` (exact alpha preservation).
- **Comment Disambiguation:**
  - Hashes (`#`) followed immediately by 3, 6, or 8 hexadecimal digits are lexed as **colors**, never comments.
  - Line comments must begin with `# ` (with trailing whitespace) or `;`.

## 3. Diagnostic Error Codes

| Code | Severity | Description | Actionable Guidance |
| :--- | :--- | :--- | :--- |
| `PIX2_ERR_HEADER` | Fatal | Missing or malformed `@pix2` header. | Add `@pix2 1.0` as the first line of the document. |
| `PIX2_ERR_COORD_BOUNDS` | Fatal | Pixel coordinate exceeds cell bounds. | Verify `x < cell_width` and `y < cell_height`. |
| `PIX2_ERR_PALETTE_KEY` | Error | Cell references undefined palette index. | Define the index in `@palette` or use direct hex. |
| `PIX2_ERR_ANIM_FRAME` | Warning | Animation references missing cell ID. | Ensure cell is defined under `@cell` block. |
| `PIX2_ERR_DUPLICATE_ID` | Warning | Cell identifier declared more than once. | Provide unique identifiers for all `@cell` blocks. |
