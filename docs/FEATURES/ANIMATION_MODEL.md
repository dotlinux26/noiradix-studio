# Animation Model & Playback Studio Specification

## 1. Animation Sequence Architecture
- **Stable ID Referencing:** Animations reference an ordered array of cell IDs:
  `frames: ["reaper_down_0", "reaper_down_1", "reaper_down_2", "reaper_down_3"]`
- **Directional Tags:**
  Standard directional presets: `down` (S), `up` (W), `right` (D), `left` (A), diagonal directions, or `none`.
- **Playback Properties:**
  - `fps`: Playback speed in frames per second (1 to 60 fps, default: 6 fps).
  - `loop`: Boolean continuous loop flag.
  - Per-frame duration support.

## 2. Animation Studio Features
- **Frame Sequence Timeline:** Visual strip displaying frame thumbnails with drag-to-reorder, duplicate, and delete controls.
- **Directional Pad (D-Pad):** 4-way and 8-way interactive D-pad for testing walk/run cycles with keyboard arrow keys.
- **Onion Skinning:** Toggles translucent overlays of previous and next animation frames to assist pixel-art animators with motion arc and easing.
- **Floating Animation Preview Window:** Dockable and draggable preview window that remains visible while working in the Cell Editor or Grid Overview.
