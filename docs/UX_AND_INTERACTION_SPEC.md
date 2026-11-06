# NOIRADIX Studio — UX & Interaction Specification

## 1. Top Navigation Bar (Header)
- **Branding Badge:** Displays the official NOIRADIX logo (32×32px, pixelated crisp rendering, matching header button heights), title "NOIRADIX", and version badge "v1.0".
- **Project Title Input:** Editable project title input that syncs with `@meta.title`.
- **Cell Resolution Presets:** Quick 1-click pills for standard pixel sizes: `16×16`, `24×24`, `32×32`, `64×64`.
- **Quick Action Buttons:**
  - `Preview`: Toggles floating animation preview window.
  - `Theme`: Toggles Light / Dark mode (persisted in localStorage).
  - `Spec`: Opens PIX2 Specification modal with built-in AI authoring prompts.
  - `Demo`: Loads sample sprite sheet.
  - `New`: Creates blank sprite sheet.
  - `Open`: Loads `.pix2` file from disk (or drag-and-drop).
  - `Save`: Saves current file directly to disk.
  - `Export`: Slices spritesheet to PNG and Unity Animation metadata JSON.

## 2. Grid Overview View
- **Row Cards:** Left-side high-contrast cards indicating `Row 0: [Title]`.
  - Duplicate Row Button: 20×20 button on each card (two overlapping squares icon) to duplicate all frames in the row, prompting for custom row name.
  - Delete Row Button: 20×20 red `[×]` button to remove the row after confirmation.
- **Column Badges:** Top badges indicating `Col 0`, `Col 1` with delete `[×]` button.
- **Row-Level Toolbar:**
  - `+ Row`: Adds new empty row.
  - `- Row`: Removes last row.
  - `+ Col`: Appends a new column to all rows and animations.
  - `- Col`: Trims the last column.
  - `Flip Row H`: Horizontally flips only the cells belonging to the active row.
  - `Flip Row V`: Vertically flips only the cells belonging to the active row.
  - `Center All`: Centers content across all cells.

## 3. Right-Click Context Menus
- **Grid Context Menu:** Distinct separation between Frame-level and Row-level actions:
  - `Edit (Current) Frame Pixels` (Double-click)
  - `Copy (Current) Frame` (Ctrl+C)
  - `Paste to (Current) Frame` (Ctrl+V)
  - `Duplicate to Next Col`
  - `Flip (Current) Frame Horizontally`
  - `Flip (Current) Frame Vertically`
  - `Clear (Current) Frame Pixels`
  - `--- Divider ---`
  - `Duplicate Row...` (prompts for custom row name)
  - `Flip Entire Row H`
  - `Flip Entire Row V`
  - `--- Divider ---`
  - `Delete Row X`
  - `Delete Column Y`
