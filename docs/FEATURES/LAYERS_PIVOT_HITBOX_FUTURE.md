# Future Schema: Layers, Pivots & Collision Hitboxes

## 1. Multi-Layer Cell Architecture (Planned v1.1)
- Extends `@cell` blocks with named visual layers:
  ```text
  @cell hero_idle_0
    layer base opacity: 1.0 visible: true
      pixel 4,5 1 pixel 5,5 1
    layer equipment opacity: 1.0 visible: true
      pixel 6,5 2
  ```
- Backwards compatible: single-layer legacy cells are automatically treated as `layer default`.

## 2. Pivot & Anchor Metadata
- Supports configurable pivot point offsets per animation clip or per cell:
  `pivot: 0.5, 1.0` (bottom-center for grounded character sprites).
- Preserved during Unity metadata export to configure sprite pivot and slice rectangles.

## 3. Collision & Combat Hitboxes
- Tagged bounding boxes for game engines:
  `hitbox damage: [2,4, 12,14]`
  `hurtbox body: [4,2, 8,14]`
- Serialized under `@meta` or per-cell extensions without corrupting core pixel parsers.

