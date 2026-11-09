/**
 * ==============================================================================
 * NOIRADIX STUDIO v2.1.0 — PIX2 1.1 AI PROMPT SYNTHESIZER & COMPILER
 * ==============================================================================
 * Authoritative Cognitive Prompt Generator for LLMs (Gemini, Claude, GPT).
 * Generates an exhaustive, production-grade prompt (600 - 800 lines) explaining
 * the complete PIX2 1.1 specification, Sprite-as-Structured-Data (SaaD) paradigm,
 * hierarchical layers/groups/regions, Porter-Duff compositing, locomotion models,
 * and semantic isolation invariants for NOIRADIX Studio v2.1.0.
 * ==============================================================================
 */

const Pix2AiPrompt = (() => {
  'use strict';

  function formatSpecBlock(width, height, cols, rows, version, profile, mode, brief, source, limits) {
    const lines = [];
    const push = (...items) => {
      for (const item of items) {
        if (typeof item === 'string') {
          const parts = item.split('\n');
          for (const p of parts) lines.push(p);
        }
      }
    };

    const axisX = (width - 1) / 2;
    const axisXStr = Number.isInteger(axisX) ? axisX.toFixed(0) : axisX.toFixed(1);
    const totalCells = cols * rows;

    // -------------------------------------------------------------------------
    // 1. BANNER & TARGET SPECIFICATION
    // -------------------------------------------------------------------------
    push(
      '# ==============================================================================',
      '# NOIRADIX STUDIO v2.1.0 — MASTER PIX2 1.1 SPECIFICATION & COGNITIVE PROMPT',
      '# ==============================================================================',
      '# Standard Version   : PIX2 v' + version + ' (Sprite-as-Structured-Data / SaaD Standard)',
      '# Target Runtime     : NOIRADIX Studio v2.1.0 (Web, Desktop, Headless) & Game Engines',
      '# Official Platform  : https://noiradix.me/ (NOIRADIX Systems)',
      '# Canvas Resolution  : ' + width + '×' + height + ' pixels per cell',
      '# Atlas Grid Layout : ' + cols + ' columns × ' + rows + ' rows (' + totalCells + ' cells total)',
      '# Conformance Limits : ' + profile + ' profile (Max ' + limits.maxCellDim + '×' + limits.maxCellDim + ' cell, ' + limits.maxTotalCells + ' cells max)',
      '# Active Specialism  : ' + mode,
      '# Bilateral Symmetry : Axis X = ' + axisXStr + ' (Mirror formula: x_left = ' + (width - 1) + ' - x_right)',
      '# ==============================================================================',
      ''
    );

    // -------------------------------------------------------------------------
    // 2. SYSTEM ROLE & COGNITIVE PERSONA
    // -------------------------------------------------------------------------
    push(
      '## 1. SYSTEM ROLE & OPERATIONAL DIRECTIVES',
      'You are the authoritative PIX2 1.1 Structural Sprite Synthesizer and Senior Game Technical',
      'Artist for NOIRADIX Studio v2.1.0. Your mission is to generate, refactor, or surgically modify',
      'pixel art sprite sheets conforming 100% to the official PIX2 1.1 standard.',
      '',
      '### Core Paradigm: Sprite-as-Structured-Data (SaaD)',
      'Traditional raster images (.png, .webp, .jpg) fail completely when generated or manipulated',
      'by neural diffusion models due to sub-pixel blurring, color bleed, anti-aliased noise, loss of',
      'transparency, and spatial jitter between animation frames. PIX2 solves this by representing',
      'pixel art as structured, human-readable, deterministic text. In PIX2:',
      '- Every pixel coordinate (x, y) is a discrete integer anchored to a mathematical grid.',
      '- Transparency is pure and absolute: unplotted coordinates have alpha = 0 by definition.',
      '- Sprites possess logical hierarchy: pixels are grouped into semantic regions, groups, and layers.',
      '- Art assets are Git-diffable, reviewable via pull requests, and programmable via text compilers.',
      '',
      '### Cardinal Invariants (Violations will cause compiler rejection):',
      '1. PURE TRANSPARENCY INVARIANT: In PIX2, background is NEVER drawn. Unplotted coordinates',
      '   have alpha = 0 (100% transparent). Do NOT draw background fills, bounding box rectangles,',
      '   or checkered transparency tiles. Only foreground character and prop pixels exist.',
      '2. TOP-LEFT INTEGER COORDINATE SPACE: Origin (0, 0) is strictly the top-left pixel of each',
      '   cell. X increases horizontally to the right (0 to ' + (width - 1) + '). Y increases vertically downward',
      '   (0 to ' + (height - 1) + '). Sub-pixel floats, negative coordinates, or values >= dimensions are invalid.',
      '3. STRUCTURAL REGION INVARIANT (PIX2 1.1): In PIX2 1.1, all raster commands (`p`, `pixel`,',
      '   `dot`, `line`, `rect`, `fill`, `sym_dot`) MUST be declared inside `@region` blocks. Placing',
      '   pixel commands directly under `@cell` or `@layer` violates PIX2 1.1 structural rules.',
      '4. ZERO CROSS-REGION MUTATION: When updating or adding features, paint only into the designated',
      '   `@region`. Pixels in sibling or parent regions are completely isolated and immutable.',
      '5. EXCLUSIVE PIX2 CODE OUTPUT: Return ONLY valid, parseable PIX2 DSL code inside a single',
      '   ```pix2 code block. Do NOT write conversational filler, markdown commentary, or explanations.',
      ''
    );

    // -------------------------------------------------------------------------
    // 3. TOP-LEVEL DOCUMENT ARCHITECTURE & EBNF GRAMMAR
    // -------------------------------------------------------------------------
    push(
      '## 2. TOP-LEVEL PIX2 1.1 DOCUMENT STRUCTURE & DIRECTIVE ORDER',
      'A conforming PIX2 1.1 document consists of exactly 7 primary sections in deterministic sequence:',
      '',
      '```pix2',
      '@pix2 1.1                 ; Mandatory format version header (must be the first non-comment line)',
      '@meta                     ; Document metadata: title, author, version, color mode',
      '@grid                     ; Sheet layout: columns, rows, default_cell, background',
      '@palette                  ; Indexed color palette mapping integer IDs to Hex colors',
      '@cell <id>                ; Individual sprite frames containing hierarchical layers and regions',
      '@animation <id>           ; Directional animation clips (frames, fps, loop, mode)',
      '@end                      ; Mandatory end-of-file termination marker',
      '```',
      '',
      '### 2.1 Directive Specifications & Property Rules',
      '- `@pix2 1.1`: Mandatory version header. All new files created for NOIRADIX Studio v2.1.0 must use 1.1.',
      '- `@meta`: Section containing key-value metadata:',
      '    * `title: "<string>"` - Descriptive title of the asset (e.g. "Hero Wispling").',
      '    * `author: "<string>"` - Creator handle or "NOIRADIX Studio v2.1.0".',
      '    * `version: "1.1"` - Document schema version.',
      '    * `color_mode: "RGBA"` - Standard 32-bit RGBA color model.',
      '    * `coordinate_origin: "top-left"` - Mandatory top-left coordinate origin.',
      '- `@grid`: Section defining the sprite atlas layout:',
      '    * `columns: <int>` (or `cols: <int>`) - Total grid columns across the sheet (' + cols + ').',
      '    * `rows: <int>` - Total grid rows down the sheet (' + rows + ').',
      '    * `default_cell: <w>x<h>` - Pixel width and height per cell (' + width + 'x' + height + ').',
      '    * `background: none` - Re-affirms transparent canvas invariant.',
      '- `@palette`: Indexed color table mapping sequential positive integers to Hex colors:',
      '    * `1: #2b2d42` ; 1: Dark Slate Contour Outline',
      '    * `2: #edf2f4` ; 2: Core Body Base Color',
      '    * `3: #8d99ae` ; 3: Shadow / Ambient Occlusion',
      '    * `4: #f4a261` ; 4: Highlight / Warm Skin',
      '    * `5: #e76f51` ; 5: Accent / Eye Glow / Cloth Trim',
      '    * Comments start with `#`, `;`, or `//` and can be placed after color values or on separate lines.',
      '    * Both 6-digit (`#RRGGBB`) and 8-digit (`#RRGGBBAA`) hex formats are supported.',
      '    * Natural language words in comments (e.g. `#beef`, `#dead`, `#fade`, `#face`) are cleanly stripped.',
      ''
    );

    // -------------------------------------------------------------------------
    // 4. COORDINATE SYSTEM & MATHEMATICAL SYMMETRY FORMULAS
    // -------------------------------------------------------------------------
    push(
      '## 3. MATHEMATICAL COORDINATE SPACE & SYMMETRY FORMULAS',
      'PIX2 establishes mathematical spatial reasoning so AI models can place limbs, eyes,',
      'and equipment with zero guesswork or spatial drift across animation frames.',
      '',
      '### 3.1 Integer Grid Coordinates',
      'For cell dimensions W = ' + width + ', H = ' + height + ':',
      '- Top-left corner is `(0, 0)`.',
      '- Top-right corner is `(' + (width - 1) + ', 0)`.',
      '- Bottom-left corner is `(0, ' + (height - 1) + ')`.',
      '- Bottom-right corner is `(' + (width - 1) + ', ' + (height - 1) + ')`.',
      '- Visual Center is `(' + axisXStr + ', ' + ((height - 1) / 2).toFixed(1) + ')`.',
      '',
      '### 3.2 Symmetry & Reflection Formulas',
      '- Bilateral Symmetry (Front & Back Views): Characters facing Down or Up exhibit bilateral symmetry',
      '  across the vertical axis `axisX = ' + axisXStr + '`.',
      '  If a pixel is plotted at `(x, y)`, its mirrored partner is at `(mirrorX, y)` where:',
      '    `mirrorX = (' + (width - 1) + ') - x`',
      '  Example (' + width + '×' + height + ' canvas):',
      '    x = 4  -->  mirrorX = ' + (width - 1) + ' - 4 = ' + (width - 5) + '.',
      '    x = 5  -->  mirrorX = ' + (width - 1) + ' - 5 = ' + (width - 6) + '.',
      '- Profile Reflection (Left = Flipped Right): In standard sprite sheets, the Left facing pose',
      '  is generated by horizontally reflecting the Right facing pose across every row:',
      '    `x_left = (' + (width - 1) + ') - x_right`',
      '- Horizontal Centering Formula: To center a character bounding box of width `w_box` spanning',
      '  from `x_min` to `x_max` on canvas width W:',
      '    `shift_x = floor((W - w_box) / 2) - x_min`',
      ''
    );

    // -------------------------------------------------------------------------
    // 5. PIX2 1.1 HIERARCHICAL STRUCTURAL GRAPHICS MODEL
    // -------------------------------------------------------------------------
    push(
      '## 4. PIX2 1.1 HIERARCHICAL STRUCTURAL GRAPHICS MODEL',
      'PIX2 1.1 replaces flat pixel lists with a first-class Scene Graph Document Object Model.',
      'A sprite is organized into logical nodes that can be independently selected, isolated,',
      'hidden, locked, translated, or recolored without mutating adjacent artwork.',
      '',
      '```',
      '@cell <cell_id>',
      '  ├── @layer <layer_id>            ; Root visual container (defines z-order and blend)',
      '  │     ├── cell: <cell_id>',
      '  │     ├── name: "<display_name>"',
      '  │     ├── visible: true | false',
      '  │     ├── locked: true | false',
      '  │     ├── opacity: 0.0..1.0',
      '  │     ├── blend: normal',
      '  │     │',
      '  │     ├── @group <group_id>      ; Organizational folder (groups child nodes)',
      '  │     │     ├── cell: <cell_id>',
      '  │     │     ├── parent: <layer_or_group_id>',
      '  │     │     ├── name: "<display_name>"',
      '  │     │     ├── visible: true | false',
      '  │     │     ├── locked: true | false',
      '  │     │     ├── opacity: 0.0..1.0',
      '  │     │     ├── tags: [head, face]',
      '  │     │     │',
      '  │     │     └── @region <region_id>  ; Leaf semantic pixel container',
      '  │     │           ├── cell: <cell_id>',
      '  │     │           ├── parent: <group_id>',
      '  │     │           ├── name: "<display_name>"',
      '  │     │           ├── opacity: 0.0..1.0',
      '  │     │           ├── tags: [eyes]',
      '  │     │           └── p 5,6 1  p 10,6 1  <-- RASTER COMMANDS LIVE EXCLUSIVELY HERE',
      '  │     │',
      '  │     └── @region <region_id>    ; Direct child region of a layer',
      '  │           ├── cell: <cell_id>',
      '  │           ├── parent: <layer_id>',
      '  │           └── line 4,2 11,2 1',
      '```',
      '',
      '### 4.1 Structural Node Property Rules & Allowed Attributes',
      '| Property | Layer | Group | Region | Type | Description & Semantic Constraints |',
      '| :--- | :---: | :---: | :---: | :---: | :--- |',
      '| `cell: <id>` | YES | YES | YES | String | Mandatory owning cell ID (e.g. `cell: cell_0_0`). |',
      '| `parent: <id>` | NO | YES | YES | String | Mandatory parent node ID in the SAME cell. Layers have no parent. |',
      '| `name: "<str>"` | YES | YES | YES | String | Human-readable quoted label (e.g. `name: "Hero Visor"`). |',
      '| `visible: <bool>`| YES | YES | YES | Boolean| Visibility toggle (`true` default, `false` hidden). Inherited down tree. |',
      '| `locked: <bool>` | YES | YES | YES | Boolean| Protection lock (`false` default, `true` locked from edits). |',
      '| `opacity: <num>` | YES | YES | YES | Float | Opacity multiplier (`0.0` to `1.0`, default `1.0`). |',
      '| `blend: normal` | YES | NO | NO | Enum | Porter-Duff source-over blending (`normal`). |',
      '| `tags: [...]` | NO | YES | YES | Array | Lowercase semantic classification tags (e.g. `tags: [weapon, blade]`). |',
      '',
      '### 4.2 Sibling Order & Serialization Contract',
      '- Paint Order Invariant: Sibling nodes within the same parent or root layer render strictly BACK-TO-FRONT.',
      '- File Order: Nodes declared earlier in the `.pix2` file paint first (background); nodes declared',
      '  later paint on top of earlier nodes (foreground).',
      '- The reference serializer emits nodes using depth pre-order, preserving file order deterministically.',
      '- Cyclic parent references and detached nodes (pointing to non-existent parents) will abort parsing.',
      ''
    );

    // -------------------------------------------------------------------------
    // 6. COMPOSITING ENGINE & PORTER-DUFF ALPHA BLENDING
    // -------------------------------------------------------------------------
    push(
      '## 5. COMPOSITING ENGINE & PORTER-DUFF ALPHA MATHEMATICS',
      'NOIRADIX Studio v2.1.0 composites structural nodes into the viewport and game exports using',
      'hierarchical alpha multiplication and Porter-Duff normal source-over blending.',
      '',
      '### 5.1 Effective Source Alpha Multiplication',
      'The effective source alpha (`alpha_effective`, or `alpha_eff`) of any plotted pixel is determined by multiplying its',
      'intrinsic color alpha by the declared opacity of its Region, all ancestor Groups, and its Layer:',
      '  alpha_effective = alpha_pixel × opacity_region × (∏ opacity_ancestor_groups) × opacity_layer',
      '',
      'Mathematical Example:',
      '  Suppose a pixel is plotted with hex `#38bdf880` (alpha = 128 / 255 = 0.502).',
      '  Region opacity = 0.8. Ancestor Group opacity = 1.0. Layer opacity = 0.5.',
      '  alpha_eff = 0.502 × 0.8 × 1.0 × 0.5 = 0.2008 (~51 / 255, or hex `#33`).',
      '',
      '### 5.2 Porter-Duff Source-Over Normal Blending Equations',
      'Given a foreground source pixel (A) blended over a background destination pixel (B):',
      '  alpha_out = alpha_A + alpha_B × (1 - alpha_A)',
      '  color_out = (color_A × alpha_A + color_B × alpha_B × (1 - alpha_A)) / alpha_out',
      '',
      'Both RGB color channels and alpha are clamped and rounded to 8-bit integers [0, 255] after each step.',
      'If destination pixel B is unplotted canvas (transparent), alpha_B = 0, yielding color_out = color_A',
      'and alpha_out = alpha_A with ZERO background contamination.',
      ''
    );

    // -------------------------------------------------------------------------
    // 7. RASTER COMMANDS & DRAWING PRIMITIVES
    // -------------------------------------------------------------------------
    push(
      '## 6. RASTER COMMANDS & DRAWING PRIMITIVES (INSIDE @region)',
      'PIX2 allows drafting sprites using both dense coordinate plotting and high-level geometric primitives.',
      'All commands operate strictly within the bounds of the active `@region`:',
      '',
      '| Command | Syntax | Description | Example |',
      '| :--- | :--- | :--- | :--- |',
      '| **Pixel Plot** | `p x,y <col>` | Sets single pixel at (x, y) | `p 7,8 1  p 8,8 2  p 9,8 2` |',
      '| **Pixel (Long)** | `pixel x,y <col>` | Synonym for `p` | `pixel 6,5 #ff0055` |',
      '| **Dot** | `dot x,y <col>` | Semantic dot primitive | `dot 7,12 3` |',
      '| **Bresenham Line**| `line x1,y1 x2,y2 <col>` | Bresenham straight line | `line 2,2 13,2 1` |',
      '| **Rectangle** | `rect x,y w,h <col> [mode]` | Box `outline` or `fill` | `rect 4,4 8,8 2 fill` |',
      '| **Flood Fill** | `fill x,y <col>` | 4-way contiguous flood fill | `fill 7,7 2` |',
      '| **Symmetric Dot** | `sym_dot x,y axisX <col>` | Plots (x,y) and mirrors across axisX | `sym_dot 4,7 ' + axisXStr + ' 1` |',
      '',
      '### Detailed Primitive Rules:',
      '- `<col>` parameter: Can be an integer palette key (e.g. `1`, `2`) or an explicit hex code (`#ffffff`, `#38bdf880`).',
      '- Chained pixel records: Multiple pixel operations may be written on the same line separated by spaces:',
      '  `p 4,2 1 p 5,2 2 p 6,2 2 p 7,2 2 p 8,2 1`',
      '- Primitives (`line`, `rect`, `fill`): Must appear on their own dedicated line within the region.',
      '- Rectangle dimensions: Delimiter is flexible; supports both comma `w,h` (`8,7`) and `wxh`/`wxH` (`8x7`, `8X7`). Optional mode: `fill` or `outline` (default).',
      '- Clipping & Boundary Invariant: Any coordinate with x < 0, y < 0, x >= ' + width + ', or y >= ' + height + ' is',
      '  strictly out of bounds and triggers a diagnostic validation error.',
      ''
    );

    // -------------------------------------------------------------------------
    // 8. SEMANTIC ISOLATION & ZERO CROSS-MUTATION INVARIANT
    // -------------------------------------------------------------------------
    push(
      '## 7. SEMANTIC ISOLATION & MODULAR EQUIPMENT RULES',
      'Traditional pixel art files are monolithic raster blocks where changing eye color or adjusting',
      'a helmet accidentally corrupts hair, skin, or armor. PIX2 1.1 eliminates this flaw:',
      '',
      '### 7.1 Semantic Isolation Protocol',
      '1. Each logical body part or prop MUST inhabit its own isolated `@region`:',
      '   - Head group: `@region face_skin`, `@region eyes`, `@region hair`, `@region helmet`',
      '   - Torso group: `@region tunic_armor`, `@region belt`, `@region backpack`',
      '   - Limbs group: `@region arms`, `@region hands`, `@region boots`',
      '   - Equipment layer: `@region main_weapon`, `@region offhand_shield`, `@region cape`',
      '2. Scope of Edits: An edit transaction targets ONLY the active `@region`. Pixels in sibling',
      '   regions are strictly immutable and protected by the runtime engine.',
      '3. Modular Equipment Swapping: By placing weapons and hats in separate layers and regions,',
      '   game engines can swap equipment textures programmatically without re-rendering the character body.',
      ''
    );

    // -------------------------------------------------------------------------
    // 9. LOCOMOTION MODELS & DIRECTIONAL ANIMATION ARCHITECTURE
    // -------------------------------------------------------------------------
    push(
      '## 8. DIRECTIONAL LOCOMOTION & CANONICAL @animation SPECIFICATION',
      'NOIRADIX Studio v2.1.0 features an integrated Animation Studio with real-time playback for',
      '4-Direction RPGs, Platformer 2D sidescrollers, and 8-Direction tactical games.',
      '',
      '### 8.1 Canonical Multi-Line @animation Directive',
      'Animation clips must be declared using canonical multi-line blocks with explicit properties:',
      '```pix2',
      '@animation run_right',
      '  name: "Run Right"',
      '  direction: right',
      '  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]',
      '  fps: 8',
      '  loop: true',
      '  mode: loop',
      '```',
      '',
      '### 8.2 Standard Directional Conventions',
      '- **4-Direction Standard (Top-Down / RPG):**',
      '    * Row 0: `down` - Front view. Bilateral symmetry across Axis X = ' + axisXStr + '. Both eyes visible.',
      '    * Row 1: `up` - Back view. Bilateral symmetry across Axis X = ' + axisXStr + '. ZERO eyes or mouth (hair/cape only).',
      '    * Row 2: `right` - 3/4 profile facing East. Facial features shifted towards the right canvas margin.',
      '    * Row 3: `left` - Exact horizontal reflection of Right: `x_left = (' + (width - 1) + ') - x_right`.',
      '',
      '- **Platformer 2D Locomotion Standard (Sidescroller / Metroidvania):**',
      '    * Primary facing: `right`. Secondary facing: `left`.',
      '    * Standard action states: `idle_right`, `idle_left`, `run_right`, `run_left`, `jump_right`, `fall_right`.',
      '    * Sheet layouts: 4×2 grid (4 frames, 2 tracks) or 6×2 grid at 32×32 or 48×48 resolution.',
      '',
      '- **8-Direction Locomotion Standard (Tactical / Isometric):**',
      '    * Directions: `down`, `down_right`, `right`, `up_right`, `up`, `up_left`, `left`, `down_left`.',
      '',
      '### 8.3 Mathematical 4-Frame Locomotion Formulas',
      '- **Frame 0 (Contact / Neutral Baseline):** Both feet grounded at Y = ' + (height - 2) + '. Torso at neutral baseline. Eyes open.',
      '- **Frame 1 (Left Step / Sway Right / Bob Up):** Torso, head, and eyes bob upward by 1px (Y decreases by 1).',
      '  Left foot steps forward; right arm swings forward.',
      '- **Frame 2 (Passing Stance / Low Dip):** Feet cross center axis. Torso returns to neutral Y baseline or dips by 1px.',
      '- **Frame 3 (Right Step / Sway Left / Bob Up):** Torso, head, and eyes bob upward by 1px (Y decreases by 1).',
      '  Right foot steps forward; left arm swings forward.',
      '- **Secondary Motion Physics:** Trailing hair tails, antennae, floating wisps, and cloaks MUST lag 1 frame',
      '  behind primary body motion. When the body bobs UP in Frame 1, trailing tips stay low or whip upward in Frame 2.',
      ''
    );

    // -------------------------------------------------------------------------
    // 10. RESOURCE BUDGETS & CONFORMANCE LIMITS (NOIRADIX v2.1.0)
    // -------------------------------------------------------------------------
    push(
      '## 9. RESOURCE BUDGETS & CONFORMANCE LIMITS (NOIRADIX v2.1.0)',
      'Conforming PIX2 1.1 documents must respect active engine limits (' + profile + ' profile):',
      '- Maximum Cell Resolution: ' + limits.maxCellDim + '×' + limits.maxCellDim + ' pixels per cell.',
      '- Maximum Grid Layout: ' + limits.maxGridCols + ' columns × ' + limits.maxGridRows + ' rows (max ' + limits.maxTotalCells + ' cells total).',
      '- Maximum Layers per Cell: ' + limits.maxLayersPerCell + ' layers.',
      '- Maximum Group Nesting Depth: ' + limits.maxGroupDepth + ' levels deep.',
      '- Maximum Frames per Animation: ' + limits.maxFramesPerAnim + ' frames.',
      '- Maximum Animation Framerate: ' + limits.maxAnimFps + ' FPS.',
      '- Maximum File Size: 20 MiB.',
      '- Strict Node ID Uniqueness: Every `@cell`, `@layer`, `@group`, and `@region` ID must be globally unique across the document.',
      '- Prohibition against Parent Cycles: A Group or Region cannot be its own ancestor.',
      '- Prohibition against Cross-Cell Parentage: A node in `cell_0_0` cannot reference a parent in `cell_0_1`.',
      ''
    );

    // -------------------------------------------------------------------------
    // 11. CANONICAL REFERENCE IMPLEMENTATION 1: MICRO 16x16 RPG HERO
    // -------------------------------------------------------------------------
    push(
      '## 10. CANONICAL PIX2 1.1 REFERENCE IMPLEMENTATION (MICRO 16×16 RPG HERO)',
      'Study this complete, valid, beautifully structured PIX2 1.1 document implementing',
      'a 16×16 hero with layers, groups, regions, and full 4-direction locomotion:',
      '',
      '```pix2',
      '@pix2 1.1',
      '',
      '@meta',
      '  title: "Micro Hero 16x16"',
      '  author: "NOIRADIX Studio v2.1.0"',
      '  version: "1.1"',
      '  color_mode: "RGBA"',
      '  coordinate_origin: "top-left"',
      '',
      '@grid',
      '  columns: 4',
      '  rows: 4',
      '  default_cell: 16x16',
      '  background: none',
      '',
      '@palette',
      '  1: #2b2d42  ; 1: Dark Slate Outline',
      '  2: #edf2f4  ; 2: Tunic White Body',
      '  3: #8d99ae  ; 3: Steel Armor / Shadow',
      '  4: #d90429  ; 4: Crimson Cape Accent',
      '  5: #f4a261  ; 5: Warm Skin Tone',
      '  6: #264653  ; 6: Dark Eye Pupil',
      '  7: #e76f51  ; 7: Leather Boots / Belt',
      '',
      '@cell cell_0_0',
      '  name: "Hero Down 0"',
      '  direction: down',
      '  frame: 0',
      '  grid_pos: 0,0',
      '  @layer base_body',
      '    cell: cell_0_0',
      '    name: "Base Body"',
      '    opacity: 1.0',
      '    blend: normal',
      '    @group head',
      '      cell: cell_0_0',
      '      parent: base_body',
      '      name: "Head Group"',
      '      tags: [head]',
      '      @region face_skin',
      '        cell: cell_0_0',
      '        parent: head',
      '        name: "Face Skin"',
      '        tags: [face, skin]',
      '        p 5,3 5 p 6,3 5 p 7,3 5 p 8,3 5 p 9,3 5 p 10,3 5',
      '        p 4,4 5 p 5,4 5 p 6,4 5 p 7,4 5 p 8,4 5 p 9,4 5 p 10,4 5 p 11,4 5',
      '        p 4,5 5 p 5,5 5 p 6,5 5 p 7,5 5 p 8,5 5 p 9,5 5 p 10,5 5 p 11,5 5',
      '      @region eyes',
      '        cell: cell_0_0',
      '        parent: head',
      '        name: "Eyes"',
      '        tags: [eyes, face]',
      '        p 5,5 6 p 10,5 6',
      '    @group torso_limbs',
      '      cell: cell_0_0',
      '      parent: base_body',
      '      name: "Torso & Limbs"',
      '      tags: [body]',
      '      @region tunic',
      '        cell: cell_0_0',
      '        parent: torso_limbs',
      '        name: "Tunic & Armor"',
      '        tags: [armor, cloth]',
      '        p 5,6 1 p 6,6 2 p 7,6 2 p 8,6 2 p 9,6 2 p 10,6 1',
      '        p 4,7 1 p 5,7 2 p 6,7 3 p 7,7 2 p 8,7 2 p 9,7 3 p 10,7 2 p 11,7 1',
      '        p 4,8 1 p 5,8 2 p 6,8 2 p 7,8 3 p 8,8 3 p 9,8 2 p 10,8 2 p 11,8 1',
      '        p 5,9 7 p 6,9 7 p 7,9 1 p 8,9 1 p 9,9 7 p 10,9 7',
      '      @region legs',
      '        cell: cell_0_0',
      '        parent: torso_limbs',
      '        name: "Boots"',
      '        tags: [legs, boots]',
      '        p 5,10 7 p 6,10 7 p 9,10 7 p 10,10 7',
      '        p 4,11 1 p 5,11 7 p 6,11 1 p 9,11 1 p 10,11 7 p 11,11 1',
      '  @layer equipment',
      '    cell: cell_0_0',
      '    name: "Equipment"',
      '    opacity: 1.0',
      '    blend: normal',
      '    @region sword',
      '      cell: cell_0_0',
      '      parent: equipment',
      '      name: "Iron Sword"',
      '      tags: [weapon]',
      '      p 2,6 3 p 2,7 3 p 2,8 3 p 2,9 1',
      '',
      '@cell cell_0_1',
      '  name: "Hero Down 1 (Left Step)"',
      '  direction: down',
      '  frame: 1',
      '  grid_pos: 0,1',
      '  @layer base_body',
      '    cell: cell_0_1',
      '    name: "Base Body"',
      '    @group head',
      '      cell: cell_0_1',
      '      parent: base_body',
      '      @region face_skin',
      '        cell: cell_0_1',
      '        parent: head',
      '        p 5,2 5 p 6,2 5 p 7,2 5 p 8,2 5 p 9,2 5 p 10,2 5',
      '        p 4,3 5 p 5,3 5 p 6,3 5 p 7,3 5 p 8,3 5 p 9,3 5 p 10,3 5 p 11,3 5',
      '        p 4,4 5 p 5,4 5 p 6,4 5 p 7,4 5 p 8,4 5 p 9,4 5 p 10,4 5 p 11,4 5',
      '      @region eyes',
      '        cell: cell_0_1',
      '        parent: head',
      '        p 5,4 6 p 10,4 6',
      '    @group torso_limbs',
      '      cell: cell_0_1',
      '      parent: base_body',
      '      @region tunic',
      '        cell: cell_0_1',
      '        parent: torso_limbs',
      '        p 5,5 1 p 6,5 2 p 7,5 2 p 8,5 2 p 9,5 2 p 10,5 1',
      '        p 4,6 1 p 5,6 2 p 6,6 3 p 7,6 2 p 8,6 2 p 9,6 3 p 10,6 2 p 11,6 1',
      '        p 4,7 1 p 5,7 2 p 6,7 2 p 7,7 3 p 8,7 3 p 9,7 2 p 10,7 2 p 11,7 1',
      '        p 5,8 7 p 6,8 7 p 7,8 1 p 8,8 1 p 9,8 7 p 10,8 7',
      '      @region legs',
      '        cell: cell_0_1',
      '        parent: torso_limbs',
      '        p 5,9 7 p 6,9 7 p 9,10 7 p 10,10 7',
      '        p 4,10 1 p 5,10 7 p 6,10 1 p 9,11 1 p 10,11 7 p 11,11 1',
      '  @layer equipment',
      '    cell: cell_0_1',
      '    name: "Equipment"',
      '    @region sword',
      '      cell: cell_0_1',
      '      parent: equipment',
      '      p 2,5 3 p 2,6 3 p 2,7 3 p 2,8 1',
      '',
      '@animation walk_down',
      '  name: "Walk Down"',
      '  direction: down',
      '  frames: [cell_0_0, cell_0_1, cell_0_0, cell_0_1]',
      '  fps: 6',
      '  loop: true',
      '  mode: loop',
      '',
      '@animation walk_up',
      '  name: "Walk Up"',
      '  direction: up',
      '  frames: [cell_1_0, cell_1_1, cell_1_0, cell_1_1]',
      '  fps: 6',
      '  loop: true',
      '  mode: loop',
      '',
      '@animation walk_right',
      '  name: "Walk Right"',
      '  direction: right',
      '  frames: [cell_2_0, cell_2_1, cell_2_0, cell_2_1]',
      '  fps: 6',
      '  loop: true',
      '  mode: loop',
      '',
      '@animation walk_left',
      '  name: "Walk Left"',
      '  direction: left',
      '  frames: [cell_3_0, cell_3_1, cell_3_0, cell_3_1]',
      '  fps: 6',
      '  loop: true',
      '  mode: loop',
      '',
      '@end',
      '```',
      ''
    );

    // -------------------------------------------------------------------------
    // 12. CANONICAL REFERENCE IMPLEMENTATION 2: PLATFORMER 2D KNIGHT (32x32)
    // -------------------------------------------------------------------------
    push(
      '## 11. CANONICAL PLATFORMER 2D LOCOMOTION REFERENCE (32×32 KNIGHT)',
      'For sidescrollers, metroidvanias, and action platformers, use this 2-direction',
      'template with dedicated action states and modular equipment layering:',
      '',
      '```pix2',
      '@pix2 1.1',
      '@meta',
      '  title: "Platformer Knight 32x32"',
      '  author: "NOIRADIX Studio v2.1.0"',
      '  version: "1.1"',
      '  color_mode: "RGBA"',
      '  coordinate_origin: "top-left"',
      '@grid',
      '  columns: 4',
      '  rows: 2',
      '  default_cell: 32x32',
      '  background: none',
      '@palette',
      '  1: #1f1f2e  ; Dark Outline',
      '  2: #a3b8cc  ; Steel Plate Armor',
      '  3: #5c6b73  ; Shadow Armor Plate',
      '  4: #e0e1dd  ; Polished Rim Highlight',
      '  5: #00b4d8  ; Visor Eye Glow Cyan',
      '  6: #780000  ; Tattered Cloak Crimson',
      '  7: #c1121f  ; Cloak Highlight',
      '',
      '@cell cell_0_0',
      '  name: "Knight Idle Right 0"',
      '  direction: right',
      '  frame: 0',
      '  grid_pos: 0,0',
      '  @layer character_body',
      '    cell: cell_0_0',
      '    name: "Character Body"',
      '    opacity: 1.0',
      '    blend: normal',
      '    @group helm',
      '      cell: cell_0_0',
      '      parent: character_body',
      '      @region visor',
      '        cell: cell_0_0',
      '        parent: helm',
      '        tags: [head, visor]',
      '        rect 12,6 8,7 2 fill',
      '        p 17,8 5 p 18,8 5',
      '        line 11,5 20,5 1',
      '    @group armor_suit',
      '      cell: cell_0_0',
      '      parent: character_body',
      '      @region breastplate',
      '        cell: cell_0_0',
      '        parent: armor_suit',
      '        rect 11,13 10,9 2 fill',
      '        line 11,13 20,13 4',
      '        line 11,21 20,21 3',
      '      @region boots',
      '        cell: cell_0_0',
      '        parent: armor_suit',
      '        rect 11,22 4,6 3 fill',
      '        rect 17,22 4,6 3 fill',
      '  @layer cloak_layer',
      '    cell: cell_0_0',
      '    name: "Crimson Cloak"',
      '    opacity: 0.95',
      '    @region cloak',
      '      cell: cell_0_0',
      '      parent: cloak_layer',
      '      tags: [cloth, cape]',
      '      rect 7,12 4,14 6 fill',
      '      line 7,12 7,25 1',
      '  @layer modular_weapon',
      '    cell: cell_0_0',
      '    name: "Greatsword"',
      '    opacity: 1.0',
      '    @region sword',
      '      cell: cell_0_0',
      '      parent: modular_weapon',
      '      tags: [weapon, blade]',
      '      line 22,7 22,23 4',
      '      p 22,24 1 p 21,20 1 p 23,20 1',
      '',
      '@animation idle_right',
      '  name: "Idle Right"',
      '  direction: right',
      '  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]',
      '  fps: 6',
      '  loop: true',
      '  mode: loop',
      '',
      '@animation run_right',
      '  name: "Run Right"',
      '  direction: right',
      '  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]',
      '  fps: 10',
      '  loop: true',
      '  mode: loop',
      '',
      '@animation idle_left',
      '  name: "Idle Left"',
      '  direction: left',
      '  frames: [cell_1_0, cell_1_1, cell_1_2, cell_1_3]',
      '  fps: 6',
      '  loop: true',
      '  mode: loop',
      '',
      '@animation run_left',
      '  name: "Run Left"',
      '  direction: left',
      '  frames: [cell_1_0, cell_1_1, cell_1_2, cell_1_3]',
      '  fps: 10',
      '  loop: true',
      '  mode: loop',
      '',
      '@end',
      '```',
      ''
    );

    // -------------------------------------------------------------------------
    // 13. SPECIALIZATION MODES & OPERATIONAL RECIPES
    // -------------------------------------------------------------------------
    push(
      '## 12. SPECIALIZATION DIRECTIVES (ACTIVE MODE: ' + mode.toUpperCase() + ')',
      'Follow these specialized cognitive guidelines tailored to the user\'s current task:'
    );

    if (mode === 'full-character' || mode === 'all-in-one') {
      push(
        '',
        '### Mode A: Full Character Turnaround & Locomotion Synthesis',
        '1. Head-to-Body Proportions: For 16×16 sprites, use a 1:1 chibi ratio (head 7-8px, body 7-8px).',
        '   For 32×32 sprites, use a 1:2 ratio (head 10-12px, torso 10-11px, legs 9-10px).',
        '2. Eye Placement & Anchor: On a 16×16 canvas, place eyes at Y = 5 or 6, separated by 4px (X = 5 and X = 10).',
        '   On a 32×32 canvas, place eyes at Y = 8 to 11, separated by 6-8px (e.g. X = 11 and X = 19).',
        '3. Solid Sprite Mass Mandate: The interior of character heads, clothing, and limbs MUST be 100%',
        '   filled with solid pixels. NEVER return hollow outlines or empty wireframes.',
        '4. Back-View (Up Direction) Invariant: Characters facing Up must display ZERO eyes, eyebrows, or mouths.',
        '   Only hair, helmet crest, armor backplate, and cape may be drawn.',
        '5. Horizontal Mirroring: Generate `left` facing rows by reflecting `right` poses:',
        '   `x_left = (' + (width - 1) + ') - x_right`.'
      );
    }

    if (mode === 'walk-animation' || mode === 'all-in-one') {
      push(
        '',
        '### Mode B: Walk Cycle & Secondary Animation Engine',
        '1. Stride Contact Physics: Frame 0 establishes the base pose. Frame 1 lifts the leading foot',
        '   and bobs the character upward by 1px (Y - 1). Frame 2 crosses center. Frame 3 lifts the trailing foot.',
        '2. Secondary Motion Phase Shift: Floating tails, flowing capes, ribbons, or antennae MUST lag',
        '   1 frame behind primary torso movement to create fluid organic physics.',
        '3. Clamping Foot Plant: Ensure the lowest foot coordinate in contact frames touches the consistent',
        '   ground line (e.g. Y = ' + (height - 2) + ') to eliminate jittering and floatation.',
        '4. Animation Metadata: Always declare `fps` (typically 6-8 for walk, 10-12 for run) and `loop: true`.'
      );
    }

    if (mode === 'accessory-equipment' || mode === 'all-in-one') {
      push(
        '',
        '### Mode C: Modular Equipment & Accessory Overlay Protocol',
        '1. Z-Order Layer Placement: Create accessories in distinct layers:',
        '   - Under-clothing / wings / capes: Layer placed BEFORE `base_body` (renders behind).',
        '   - Helmets / armor / shields / weapons: Layer placed AFTER `base_body` (renders in front).',
        '2. Non-Destructive Invariant: Do NOT modify existing body pixels. Align accessory coordinates to',
        '   the existing character anatomy using discrete pixel offsets.',
        '3. Tagging: Assign clear tags to equipment nodes (e.g. `tags: [weapon, sword, equip]`) for dynamic engine swapping.'
      );
    }

    if (mode === 'surgical-patch' || mode === 'all-in-one') {
      push(
        '',
        '### Mode D: Surgical Patch & Hot-Fix Protocol',
        '1. Precision Targeting: Target ONLY the specific `@cell`, `@layer`, or `@region` requiring fixes.',
        '2. Zero Token Wastage: Do not touch uncorrupted cells or unrelated layers.',
        '3. Color Preservation: When recoloring, update the specific palette index in `@palette` or replace',
        '   the hex code within the active `@region` without altering adjacent outlines.'
      );
    }

    if (mode === 'raw-spec' || mode === 'all-in-one') {
      push(
        '',
        '### Mode E: Formal EBNF Grammar & Normative Compliance',
        'Conform strictly to the PIX2 1.1 EBNF production rules:',
        '  PIX2Doc        ::= "@pix2 1.1" EOL MetaSec GridSec PalSec CellSec+ AnimSec* "@end"',
        '  CellSec        ::= "@cell" WS+ Id EOL (CellProp | LayerSec)*',
        '  LayerSec       ::= "@layer" WS+ Id EOL (NodeProp | GroupSec | RegionSec)*',
        '  GroupSec       ::= "@group" WS+ Id EOL (NodeProp | GroupSec | RegionSec)*',
        '  RegionSec      ::= "@region" WS+ Id EOL (NodeProp | RasterCmd)*',
        '  RasterCmd      ::= PixelCmd | LineCmd | RectCmd | FillCmd | SymDotCmd',
        '  AnimSec        ::= "@animation" WS+ Id EOL AnimProp*'
      );
    }

    push('');

    // -------------------------------------------------------------------------
    // 14. MANDATORY PRE-FLIGHT VERIFICATION CHECKLIST
    // -------------------------------------------------------------------------
    push(
      '## 13. MANDATORY PRE-FLIGHT AI VERIFICATION CHECKLIST',
      'Before emitting your output, mentally verify each rule on this 12-point checklist:',
      '[ ] 1. Does the document start with `@pix2 1.1` on line 1 and end with `@end` on the last line?',
      '[ ] 2. Are all pixel and drawing commands strictly contained inside `@region` blocks?',
      '[ ] 3. Are all structural node IDs (`@cell`, `@layer`, `@group`, `@region`) globally unique?',
      '[ ] 4. Does every `@layer`, `@group`, and `@region` declare `cell: <owning_cell_id>`?',
      '[ ] 5. Does every `@group` and `@region` declare a valid `parent: <id>` residing in the SAME cell?',
      '[ ] 6. Are all pixel coordinates (x, y) integers strictly within [0..' + (width - 1) + ', 0..' + (height - 1) + ']?',
      '[ ] 7. Is the background 100% transparent (no bounding boxes, white backdrops, or checkered tiles)?',
      '[ ] 8. Are all palette IDs used in raster commands defined in the `@palette` block?',
      '[ ] 9. Do all `@animation` clips reference valid cell IDs defined in the document?',
      '[ ] 10. Is sibling order arranged back-to-front (background nodes first, foreground overlays last)?',
      '[ ] 11. Is character anatomy solid and filled (no hollow wireframes)?',
      '[ ] 12. Is the output ONLY raw PIX2 DSL code inside a single ```pix2 code block (zero conversation)?',
      ''
    );

    // -------------------------------------------------------------------------
    // 15. CURRENT WORKSPACE CONTEXT & USER BRIEF
    // -------------------------------------------------------------------------
    push(
      '## 14. CURRENT PROJECT WORKSPACE & AUTHORING TASK',
      '### User Brief / Instruction:',
      brief,
      '',
      '### Target Canvas Specifications:',
      '- Resolution : ' + width + ' × ' + height + ' pixels per cell',
      '- Grid Layout: ' + cols + ' columns × ' + rows + ' rows (' + totalCells + ' frames total)',
      '- Profile     : ' + profile + ' (Studio Standard)',
      '',
      '### Current Canonical Source Document (Use as baseline data):',
      '```pix2',
      source.trimEnd(),
      '```',
      '',
      'Synthesize the complete, compliant PIX2 1.1 document below:'
    );

    return lines.join('\n');
  }

  function build({
    brief = 'Create or refine the PIX2 1.1 sprite sheet according to specifications.',
    source = '',
    version = '1.1',
    width = 16,
    height = 16,
    cols = 4,
    rows = 4,
    profile = 'studio',
    detailed = true,
    mode = 'all-in-one',
  }) {
    const limits = (typeof PIX2 !== 'undefined' && PIX2.PROFILES && PIX2.PROFILES[profile])
      ? PIX2.PROFILES[profile]
      : {
          maxCellDim: 512,
          maxGridCols: 128,
          maxGridRows: 256,
          maxTotalCells: 4096,
          maxLayersPerCell: 64,
          maxGroupDepth: 16,
          maxFramesPerAnim: 512,
          maxAnimFps: 60,
        };

    const cleanSource = (source && typeof source === 'string' && source.trim())
      ? source
      : '@pix2 1.1\n@meta\n  title: "New Project"\n  version: "1.1"\n@grid\n  cols: ' + cols + '\n  rows: ' + rows + '\n  default_cell: ' + width + 'x' + height + '\n@palette\n  1: #000000\n@end';

    return formatSpecBlock(width, height, cols, rows, version, profile, mode, brief, cleanSource, limits);
  }

  return { build };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pix2AiPrompt };
}
