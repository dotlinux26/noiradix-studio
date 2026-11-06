# Zoom, Rulers & Coordinate Systems Specification

## 1. Viewport Transformation & Zoom Anchoring
- **Zoom Range:** 1× to 64× with smooth nearest-neighbor pixel scaling.
- **Alt + Wheel Zooming:**
  - When a selection is active: zooms centered on the selection anchor.
  - When no selection is active: zooms centered on cursor coordinate $(x, y)$, keeping the target pixel fixed under the pointer.
- **Space + Drag Pan:**
  - Fluid panning with middle-click drag or Spacebar + left-click drag.

## 2. Integrated Pixel Rulers
- Permanent top and left rulers integrated with the canvas viewport.
- Tick marks correspond to exact integer pixel coordinates.
- Sub-pixel offset compensation maintains 1:1 alignment with the raster pixel grid at all zoom levels.

## 3. Real-Time Status Bar Coordinates
- Bottom status bar reports live cursor coordinates:
  `Frame: [Cell ID] | Pixel: [X: 4, Y: 7] (16×16 = 256 px) | Color: #504a67`
- Accurately accounts for viewport scrolling, device pixel ratio (DPR), and ruler offsets.

