# Selection Tools & Context Menus Specification

## 1. Selection Engine
- **Select Tool (`V`):** Activates rectangular marquee selection mode on the active cell canvas.
- **Marquee Mechanics:**
  - Dragging defines a bounding box `[x0, y0, w, h]`.
  - Floating Selection: Moving a selection detaches pixels into a temporary floating layer.
  - Operations: Cut (`Ctrl+X`), Copy (`Ctrl+C`), Paste (`Ctrl+V`), Fill, Flip Horizontal, Flip Vertical, Invert, Clear (`Delete`).
  - Committing: Clicking outside or switching tools stamps floating pixels permanently into the cell pixel map.

## 2. Right-Click Context Menus
- **Grid Overview Menu:**
  - Explicit distinction between single-frame actions (`Edit (Current) Frame Pixels`, `Flip (Current) Frame Horizontally`, `Clear (Current) Frame Pixels`) and row-level actions (`Duplicate Row...`, `Flip Entire Row H`, `Flip Entire Row V`, `Delete Row`).
- **Cell Editor Menu:**
  - Cut, Copy, Paste, Fill Selection, Flip H, Flip V, Select All, Deselect, Delete Selection.
- **Safety Standard:**
  - Right-clicking never accidentally paints a pixel.
  - Menus clamp within browser window viewport bounds.
