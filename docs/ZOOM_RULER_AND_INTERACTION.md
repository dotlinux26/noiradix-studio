# NOIRADIX Studio — Zoom, Rulers & Viewport Interaction Specification

**Document Version:** 1.0.0  
**Project:** NOIRADIX Studio  
**Target Invariant:** Pixel-perfect coordinate alignment, anchor-centered zoom, and permanently attached rulers.

---

## 1. Anchor-Centered Zoom Specification (`Alt + Wheel` & Wheel)

In conventional naive canvas implementations, changing the zoom level scales the entire container from the top-left $(0, 0)$ origin, causing the sprite under the user's cursor to jump hundreds of pixels across the screen.

**In NOIRADIX Studio, zoom is mathematically anchored to the cursor coordinate or active selection.**

```
                                  [ Viewport Window ]
                                           |
                                           v
       Before Zoom (16x)                                  After Zoom (24x)
  +--------------------------+                      +--------------------------+
  |                          |                      |        . [Cursor]        |
  |       . [Cursor]         |    Alt + Wheel Up    |       (Same pixel stays  |
  |      Pixel (7, 12)       |  =================>  |        under cursor)     |
  |                          |                      |                          |
  +--------------------------+                      +--------------------------+
```

### Mathematical Formulation
Let:
- $(c_x, c_y)$ be client mouse position relative to the canvas origin.
- $Z_{\text{old}}$ and $Z_{\text{new}}$ be the previous and new zoom multipliers.
- $(p_x, p_y) = (\lfloor c_x / Z_{\text{old}} \rfloor, \lfloor c_y / Z_{\text{old}} \rfloor)$ be the targeted integer cell pixel.
- $S_x, S_y$ be the current `viewport.scrollLeft` and `viewport.scrollTop`.

The viewport scroll adjustment required to keep $(p_x, p_y)$ stationary under the mouse cursor is:
$$\Delta S_x = p_x \cdot (Z_{\text{new}} - Z_{\text{old}})$$
$$\Delta S_y = p_y \cdot (Z_{\text{new}} - Z_{\text{old}})$$

$$S_{x, \text{new}} = S_x + \Delta S_x$$
$$S_{y, \text{new}} = S_y + \Delta S_y$$

### Selection-Focused Zoom:
When a rectangular selection region is active, pressing `Ctrl + 0` or double-clicking the zoom tool automatically computes:
$$Z_{\text{fit}} = \min\left(\frac{\text{ViewportWidth}}{W_{\text{sel}}}, \frac{\text{ViewportHeight}}{H_{\text{sel}}}\right)$$
and centers the selection marquee in the viewport.

---

## 2. The Ruler Invariant: Rulers NEVER Disappear

> **Critical Rule:** The measurement rulers are an essential, integral organ of NOIRADIX Studio. **The rulers MUST NEVER disappear or detach from the canvas during zoom or pan.**

### Structural Integration:
The top and left rulers are not floating HTML overlays pinned to the screen window. They are direct grid children of the `.canvas-container-with-rulers` element wrapping `.canvas-stack`:

```
+------------------------------------------------------------+
| .canvas-container-with-rulers                              |
| +----------------+---------------------------------------+ |
| | .ruler-corner  | .ruler-top-bar (Ticks: 0, 1, 2... W-1)| |
| +----------------+---------------------------------------+ |
| | .ruler-left-bar| .canvas-stack                         | |
| | (Ticks: 0..H-1)|   #cell-canvas (Checker & Pixels)     | |
| |                |   #cell-overlay (Cursor HUD & Drag)   | |
| +----------------+---------------------------------------+ |
+------------------------------------------------------------+
```

### Dynamic Tick Alignment:
For every zoom level $Z \in [4, 64]$:
- Width of each top ruler tick mark:
  $$\text{tick.style.width} = Z + \text{"px"}$$
- Height of each left ruler tick mark:
  $$\text{tick.style.height} = Z + \text{"px"}$$
- Integer labels are printed every 4 pixels (`0, 4, 8, 12...`) and at the final edge ($W-1$, e.g. `15` for a 16px cell).
- The tick border aligns to the nearest sub-pixel boundary (`0.5px`), guaranteeing that tick mark $k$ precisely aligns with the $k$-th pixel column or row of the canvas.

---

## 3. Smooth Canvas Panning (`Space + Drag` & Middle Click)

To provide an effortless workflow identical to Photoshop, Aseprite, and Figma:
1. **Space Key Down:** Viewport cursor switches to `grab`. The canvas overlay drawing is temporarily suspended.
2. **Space + Left Mouse Drag** (or **Middle Mouse Drag**):
   - Viewport cursor switches to `grabbing`.
   - Directly offsets `viewport.scrollLeft` and `viewport.scrollTop`.
3. **Space Key Up:** Viewport cursor reverts to active drawing tool crosshair.

---

## 4. Keyboard Shortcuts Standard Reference

| Key Combination | Action | Description |
| :--- | :--- | :--- |
| **Alt + Mouse Wheel** | Anchor Zoom | Zoom in/out centered on the hovered pixel coordinate. |
| **Space + Mouse Drag** | Pan Viewport | Smoothly pan the canvas viewport. |
| **Middle Click Drag** | Pan Viewport | Alternative one-handed panning shortcut. |
| **V** or **M** | Selection Tool | Marquee selection tool. |
| **B** | Pencil Tool | 1px precise pixel plot. |
| **E** | Eraser Tool | Transparent pixel eraser. |
| **G** | Paint Bucket | Flood fill contiguous color region. |
| **I** | Eyedropper | Pick color under cursor. |
| **L** | Line Tool | Bresenham straight pixel line. |
| **U** | Rectangle Tool | Outline or filled box. |
| **S** | Symmetry Mirror | Toggle vertical mirror axis. |
| **X** | Swap Colors | Swap Primary and Secondary active colors. |
| **D** | Reset Colors | Reset Primary to palette dark, Secondary to white. |
| **Ctrl + 0** | Reset View | Reset zoom to 24x and center canvas. |
| **Ctrl + Z** | Undo | Undo last logical stroke, edit, or metadata change. |
| **Ctrl + Y** / **Ctrl+Shift+Z** | Redo | Redo previously undone operation. |
| **Ctrl + S** | Save | Save to original `.pix2` file on disk. |
| **Ctrl + Shift + S** | Save As | Save project to a new file destination. |
| **Ctrl + O** | Open | Open `.pix2` or PNG file from local computer. |
| **Ctrl + N** | New Project | Create blank sprite sheet. |
| **Arrow Keys** | Nudge Content | Translate pixels within active cell by $(\pm 1, \pm 1)$. |
