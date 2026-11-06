# Grid Overview & Cell Architecture Specification

## 1. Multi-Tier Cell Resolution (`getCellAtGrid`)
To maintain 100% interoperability between Noiradix-generated sprite sheets and externally generated AI files, Noiradix Studio resolves cell artwork through a 4-tier lookup:

1. **Exact Standard Alias:** Checks `doc.cells['cell_' + r + '_' + c]`.
2. **Explicit Coordinate Mapping:** Matches any cell where `cell.row === r && cell.col === c` (derived from `@cell ... grid_pos: r,c`).
3. **Direction and Frame Tags:** Matches cells where `cell.direction === dirMap[r]` and `cell.frame === c`.
4. **Animation Sequence Bindings:** If an animation is assigned to row `r`, maps `doc.animations[animKey].frames[c]`.

## 2. Row-Level Operations (Row Cards)
- **Duplicate Row:**
  - Located on each Row card in the Grid Overview canvas, positioned immediately to the left of the delete button.
  - Size: 20×20 px, bo góc 4px, icon vector 2 ô vuông clone xếp chồng.
  - Prompts user: `Enter name for duplicated row: [Row Title] Copy`.
  - Duplicates all cell frames, deep-copies pixels, increments row count, and registers a new animation sequence.
- **Row-Only Flip H & Flip V:**
  - Toolbar buttons `Flip Row H` and `Flip Row V` and right-click context menu options strictly transform frames in the selected row without affecting other rows.
- **Row Deletion:**
  - Red `[×]` button prompts with an artwork impact warning before removing the row and shifting subsequent rows up.

## 3. Label Marquee Scrolling
- When row titles or cell IDs exceed available pill bounds, the canvas and HTML badges apply smooth marquee text scrolling, preventing awkward multi-line text wrapping.
