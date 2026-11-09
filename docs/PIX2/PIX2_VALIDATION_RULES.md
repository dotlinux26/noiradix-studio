# PIX2 Validation Rules & Diagnostic Error Matrix

The [root PIX2 1.1 specification](../../PIX2_SPECIFICATION.md) defines the current file contract.

## 1. Syntax & Structural Constraints
1. **Header Requirement:** Begin with `@pix2 1.0` or `@pix2 1.1`.
2. **Prototype Pollution Protection:**
   - Any directive key, identifier, or palette index matching `__proto__`, `constructor`, or `prototype` is strictly rejected and scrubbed during lexing.
3. **Safety Coordinate Boundaries:**
   - Maximum cell dimensions depend on the resource profile. Studio uses 512×512 and PixelArt uses 1024×1024. The standalone reference engine can opt into the 2048×2048 profile.
   - Coordinates must be integers inside their owning cell. Strict mode promotes out-of-bounds and clamping warnings to errors.

## 2. Color & Palette Integrity
- **Hex Code Formats:**
  - 3-character RGB: `#RGB` (normalized to `#RRGGBB`).
  - 4-character RGBA: `#RGBA` (normalized to `#RRGGBBAA`).
  - 6-character RGB: `#RRGGBB`.
  - 8-character RGBA: `#RRGGBBAA` (exact alpha preservation).
- **Comment Disambiguation:**
  - Hashes (`#`) followed immediately by 3, 4, 6, or 8 hexadecimal digits are lexed as colors.
  - Line comments must begin with `# ` (with trailing whitespace) or `;`.

## 3. Diagnostic Error Codes

| Code | Severity | Description | Actionable Guidance |
| :--- | :--- | :--- | :--- |
| `PIX2_ERR_HEADER` | Fatal | Missing or malformed `@pix2` header. | Add `@pix2 1.0` as the first line of the document. |
| `PIX2_ERR_COORD_BOUNDS` | Fatal | Pixel coordinate exceeds cell bounds. | Verify `x < cell_width` and `y < cell_height`. |
| `PIX2_ERR_PALETTE_KEY` | Error | Cell references undefined palette index. | Define the index in `@palette` or use direct hex. |
| `PIX2_ERR_ANIM_FRAME` | Warning | Animation references missing cell ID. | Ensure cell is defined under `@cell` block. |
| `PIX2_ERR_DUPLICATE_ID` | Warning | Cell identifier declared more than once. | Provide unique identifiers for all `@cell` blocks. |
| `PIX2_ERR_INVALID_OPACITY` | Error | Layer, Group or Region opacity is malformed or outside 0–1. | Use a finite decimal such as `0.5`. |
| `PIX2_ERR_HIERARCHY_CYCLE` | Error | A Group reaches itself through its parents. | Break the cycle by assigning the correct parent. |
| `PIX2_ERR_RESOURCE_LIMIT` | Error | A structural limit such as Group depth is exceeded. | Reduce nesting or use a suitable compiler profile. |

