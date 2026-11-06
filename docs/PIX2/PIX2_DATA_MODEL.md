# PIX2 In-Memory Data Model & Schema Specification

## 1. Complete Document Schema
A valid parsed PIX2 document in memory conforms to the following JavaScript structure:

```typescript
interface Pix2Document {
  meta: {
    title: string;              // e.g. "Hero Wispling Walk"
    author: string;             // e.g. "dotlinux26"
    version: string;            // e.g. "1.0"
    colorMode: "RGBA" | "RGB";  // Default: RGBA
    coordinateOrigin: "top-left";
    grid: {
      cols: number;             // Total column frames per row (default: 4)
      rows: number;             // Total directional rows (default: 4)
    };
    cellSize: {
      w: number;                // Cell width in pixels (16, 24, 32, 64)
      h: number;                // Cell height in pixels
    };
    background?: string;        // "none" or hex color
  };

  palette: {
    [colorKey: string | number]: string; // "1": "#292438", "accent": "#ff6b8bcc"
  };

  cells: {
    [cellId: string]: Pix2Cell;
  };

  animations: {
    [animName: string]: Pix2Animation;
  };
}

interface Pix2Cell {
  id: string;                   // Stable unique identifier (e.g. "reaper_down_0")
  name: string;                 // Display label (e.g. "Reaper Down Frame 1")
  row: number;                  // Grid row index (0-based)
  col: number;                  // Grid col index (0-based)
  frame?: number;               // Sequential frame index within row
  direction?: string;           // "down" | "up" | "right" | "left" | "none"
  pixels: {
    [coord: string]: string;    // "x,y": "#RRGGBB" or "#RRGGBBAA"
  };
}

interface Pix2Animation {
  name?: string;                // Display title
  direction?: string;           // "down" | "up" | "right" | "left" | "none"
  fps: number;                  // Playback speed in frames per second (default: 6)
  loop: boolean;                // Continuous looping flag
  frames: string[];             // Ordered array of stable cell IDs
}
```

## 2. Decoupling Principle: Cell IDs vs Grid Positions
- **Stable Alphanumeric Identifiers:** Cell IDs (e.g., `reaper_down_0`, `hero_attack_3`) are immutable identities. They are never rewritten or renamed when rows/columns move or when the user edits frame names.
- **Independent Coordinate Mapping:**
  - A cell's physical position in the sprite sheet layout is resolved through explicit `row` and `col` properties (derived from `@cell ... grid_pos: r,c`).
  - Animations point strictly to cell IDs, meaning rows can be reordered or flipped without breaking animation timelines.
- **Multi-Tier Resolution (`getCellAtGrid`):**
  1. Standard convention check: `doc.cells['cell_' + r + '_' + c]`.
  2. Coordinate match: `cell.row === r && cell.col === c`.
  3. Direction & frame tag match: `cell.direction === dirMap[r] && cell.frame === c`.
  4. Animation frame binding: `doc.animations[rowAnim].frames[c]`.
