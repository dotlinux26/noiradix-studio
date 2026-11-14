# AI 8-direction bat sprite review

**Status:** Evidence review; no PIX2 or rendering behavior changed.

## Input and verification

- **Artifact reviewed:** `Shadow Batmob RPG 64x64 8-Dir (1).pix2`, supplied from the user's Downloads folder, plus the attached Studio screenshot.
- **App/format:** Studio v2.2.0 workspace; document declares PIX2 1.1 and its author field says `NOIRADIX Studio v2.1.0`. That field is source text, not proof of which model or prompt produced the art.
- **Format check:** Current `PIX2.parseValidated(..., { strict: true })` accepts the file with zero errors and zero warnings.
- **Structure:** 32 cells (64×64), eight directional animations, four frames each at 8 FPS. Every animation reference resolves to a cell whose direction and frame number match. No evidence of a parser/frame-index mismatch in this artifact.

## Wing color finding

- Wing artwork is explicit raster data inside `@region region_wings_*`; the file contains 29,946 `pixel` commands and no `line`, `rect`, or flood-fill commands. The parsed document has 28,584 unique painted pixel positions after overlap/compositing.
- The declared palette maps IDs 5 and 6 to `#4f2a42` and `#7a3e63`; wing regions explicitly use those colors, alongside outline/shadow colors. The renderer has no semantic rule that recolors wings. It renders the colors encoded in the PIX2 source.
- Therefore, if the user's intended wing color was stated in the prompt/reference and the file uses these other colors, the mismatch is in the generated artwork. If the intended color was not specified, this is an underspecified art direction rather than a PIX2 decoding defect. The original prompt and model identity are needed to distinguish those cases.
- The model maintained a valid structure but most nodes have fallback labels: 141 of 148 Regions and 58 of 64 Groups use their identifier as their display name. This is evidence of output consistency degrading in naming across a large repetitive document; it does not itself explain the wing color.

## Confirmed prompt quality gaps

- `js/pix2-ai-prompt.js` still identifies itself and its target runtime as Studio v2.1.0 in 13 source occurrences, while the app is v2.2.0.
- The prompt's 8-direction section lists the eight directions but does not provide a complete 8-direction × frame grid example or an explicit layout/mapping rule. Its complete examples are 4-direction and platformer examples.
- A global four-frame locomotion recipe prescribes grounded contact, left/right steps and foot movement. That is a poor fit for an explicitly flying `fly_*` animation and can encourage the model to reuse walk-cycle assumptions.
- These are credible prompt-quality contributors to consistency, but they do not prove why the model chose the wing colors in this particular output. The prompt does not appear to assign a required semantic color ID to wings.

## Deferred PIX2 language idea

Do not add a new primitive in this review. Record the idea for a later PIX2 version: provide a concise, persistent way to describe filling a closed shape or bounded semantic region with a color, instead of asking an AI to enumerate every interior pixel.

PIX2 1.1 already has `rect ... fill` and `fill x,y color`. The latter is a four-way flood fill of contiguous pixels, and the current reference parser rasterizes both operations to pixels; canonical serialization then expands the result to explicit pixel records. A future proposal must clearly distinguish a source-preserved closed-shape fill from the existing flood-fill operation and define clipping, holes/boundaries, alpha/opacity, layer/Region ownership, and resource limits before implementation.

## Follow-up evidence needed

- Obtain the exact prompt/instructions and model/version used for this artifact.
- Ask what color the wings were meant to use, and whether that color was explicitly specified.
- Compare the original reference image (if any) to the rendered cells. Without those inputs, label the color as a visual mismatch reported by the user, not a proven model-policy violation.
