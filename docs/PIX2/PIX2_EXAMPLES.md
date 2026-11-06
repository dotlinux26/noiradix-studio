# PIX2 Canonical Document Examples

## 1. Minimal Static Prop (Potion Item)
```text
@pix2 1.0

@meta
  title: "Health Potion"
  author: "dotlinux26"
  version: "1.0"
  color_mode: "RGBA"

@grid
  columns: 1
  rows: 1
  default_cell: 16x16

@palette
  1: #1a162b ; Outline dark
  2: #ef4444 ; Crimson liquid
  3: #fca5a5 ; Glass highlight
  4: #d1d5db ; Cork stopper

@cell potion_idle
  name: "Potion"
  grid_pos: 0,0
  pixel 7,3 4 pixel 8,3 4
  pixel 6,4 1 pixel 7,4 4 pixel 8,4 4 pixel 9,4 1
  pixel 5,5 1 pixel 6,5 3 pixel 9,5 1 pixel 10,5 1
  pixel 5,6 1 pixel 6,6 2 pixel 7,6 2 pixel 8,6 2 pixel 9,6 2 pixel 10,6 1
  pixel 5,7 1 pixel 6,7 2 pixel 7,7 2 pixel 8,7 2 pixel 9,7 2 pixel 10,7 1
  pixel 6,8 1 pixel 7,8 1 pixel 8,8 1 pixel 9,8 1

@end
```

## 2. 4-Directional Walk Cycle (Compact Serializer Output)
```text
@pix2 1.0

@meta
  title: "Ashen Reaper - Four Direction Walk"
  author: "Noiradix Studio Sample"
  version: "1.0"
  color_mode: "RGBA"
  coordinate_origin: "top-left"

@grid
  columns: 4
  rows: 4
  default_cell: 16x16
  background: none

@palette
  1: #292438
  2: #504a67
  3: #39334f
  4: #e8e6f0
  5: #78dceb
  6: #bfc8d9
  7: #9587b5
  8: #77708f

@cell reaper_down_0
  name: "Reaper Down 1"
  direction: down
  frame: 0
  grid_pos: 0,0
  pixel 4,0 1 pixel 5,0 1 pixel 6,0 1 pixel 7,0 1 pixel 8,0 1 pixel 13,0 1 pixel 14,0 1
  pixel 3,1 1 pixel 4,1 2 pixel 5,1 8 pixel 6,1 8 pixel 7,1 8 pixel 8,1 8 pixel 9,1 1 pixel 10,1 1 pixel 12,1 1 pixel 13,1 6 pixel 14,1 6 pixel 15,1 1
  pixel 3,2 1 pixel 4,2 8 pixel 5,2 3 pixel 6,2 3 pixel 7,2 3 pixel 8,2 3 pixel 9,2 8 pixel 10,2 8 pixel 11,2 1 pixel 12,2 8 pixel 13,2 1 pixel 14,2 1 pixel 15,2 7
  pixel 2,3 1 pixel 3,3 2 pixel 4,3 3 pixel 5,3 1 pixel 6,3 1 pixel 7,3 1 pixel 8,3 1 pixel 9,3 3 pixel 10,3 3 pixel 11,3 1 pixel 12,3 1 pixel 15,3 7
  pixel 2,4 1 pixel 3,4 3 pixel 4,4 1 pixel 5,4 4 pixel 6,4 4 pixel 7,4 4 pixel 8,4 4 pixel 9,4 1 pixel 10,4 3 pixel 11,4 3 pixel 12,4 1 pixel 14,4 7 pixel 15,4 7
  pixel 2,5 1 pixel 3,5 3 pixel 4,5 1 pixel 5,5 1 pixel 6,5 4 pixel 7,5 4 pixel 8,5 1 pixel 9,5 1 pixel 10,5 3 pixel 11,5 3 pixel 12,5 1 pixel 14,5 7
  pixel 2,6 1 pixel 3,6 3 pixel 4,6 1 pixel 5,6 5 pixel 6,6 4 pixel 7,6 4 pixel 8,6 5 pixel 9,6 1 pixel 10,6 3 pixel 11,6 2 pixel 12,6 1 pixel 14,6 7

@animation walk_down
  name: "Walk Down"
  direction: down
  fps: 6
  loop: true
  frames: [reaper_down_0, reaper_down_1, reaper_down_2, reaper_down_3]

@end
```
