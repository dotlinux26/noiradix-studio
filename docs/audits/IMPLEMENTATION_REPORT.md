# Master Upgrade & Implementation Report

Product: NOIRADIX Studio  
Date: 2026-11-07  
Author: dotlinux26 (Nguyen Duc Canh)  

## Upgrades Implemented

### 1. App Header Logo Fit
- Increased `.brand-logo-img` height and width from 24px to 32px in `css/style.css`.
- Aligns flush with the 32px height of top navigation buttons and inputs.

### 2. Context Menu Clarification (`(Current) Frame`)
- Explicitly labeled single-frame operations in the grid overview context menu:
  - `Edit (Current) Frame Pixels`
  - `Copy (Current) Frame`
  - `Paste to (Current) Frame`
  - `Flip (Current) Frame Horizontally`
  - `Flip (Current) Frame Vertically`
  - `Clear (Current) Frame Pixels`
- Clearly demarcated from row-level operations (`Duplicate Row...`, `Flip Entire Row H`, `Flip Entire Row V`, `Delete Row`).

### 3. Row-Only Flip Horizontal & Vertical
- Fixed both top toolbar buttons (`#btn-sheet-flip-h`, `#btn-sheet-flip-v`) and context menu items to execute `flipRow(rowIdx, isH)`.
- Guarantees that only frames in the active row are transformed; all other rows and animations remain 100% untouched.

### 4. Row Duplicate Button on Row Card
- Added a 20×20 button with a custom dual-square clone vector icon on every Row Card in the Grid Overview canvas.
- Located directly to the left of the red delete `[×]` button.
- Prompts user for a custom row name with default `[RowName] Copy`.
- Automatically clones all frames, deep copies pixel data, increments grid rows, and creates a registered animation sequence.

### 5. Palette Auto-Generation from Artwork
- Added "Generate from Artwork" collapsible panel under the Palette sidebar.
- Scans either active cell or entire document.
- Supports Exact mode (frequency-sorted) and Reduce mode (top N colors).
- Includes "Add to Palette" (preserves existing palette) and "Replace Palette" (atomic remapping).

### 6. Safe Row Animation Assignment (Zero Pixel Loss)
- Re-architected `assignRowToAnimation` to locate and bind existing cells via `getCellAtGrid(doc, rowIdx, c)` rather than assuming synthetic `cell_R_C` IDs.
- Preserves 100% of custom cell IDs (e.g. `walk_right_copy_0`, `reaper_down_0`) and all pixel artwork without generating empty dummy cells or white checkerboards.

### 7. Row Reordering & Drag-and-Drop
- Implemented `moveRow(fromIdx, toIdx)` with permutation calculation, cell coordinate updates, and standard ID key-collision prevention.
- Added visual Move Up `[▲]` and Move Down `[▼]` buttons directly on each Row Card header.
- Added "Move Row Up" and "Move Row Down" context menu options with boundary visibility checks.
- Implemented canvas-level pointer drag-and-drop on Row Cards with live dashed drop line, "Drop at Row X" floating indicator badge, and cursor state handling (`grab` / `grabbing`).

### 8. Row Card Layout & Breathing Room
- Expanded Row Card dimensions to 152×56px.
- Shifted row title and animation label downwards to `cardY + 34` with 132px horizontal visible width.
- Prevents text from colliding with upper management buttons (`[▲]`, `[▼]`, `[Clone]`, `[×]`).
- Auto-scrolls long text smoothly with marquee when overflow occurs.

### 9. Continuous Seamless Marquee on Inspector Badge
- Replaced alternate-reversing CSS animation on `#grid-selected-badge` with a continuous infinite loop track (`[text] [24px spacer] [text]` from `0%` to `-50%`).
- Matches the seamless canvas marquee behavior on sprite frame pills.

### 10. Automated Test Coverage
- `tests/test-roundtrip.js`: 41/41 tests passing.
- `tests/test-security.js`: 13/13 tests passing.
- Total: 54/54 passing (100%).

