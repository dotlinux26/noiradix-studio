# PIX2 Future Directions: Coordinate-Aware Raster Editing

**Status:** Exploratory proposal — non-normative  
**Scope:** Research direction for independent PIX2 ecosystem developers  
**Compatibility:** Does not change PIX2 v1.0 grammar, parser behavior, or NOIRADIX Studio's current feature set  
**Implementation commitment:** None

---

## 1. Why This Direction Is Worth Exploring

PIX2's current strength is its treatment of 2D pixel artwork as structured, addressable data rather than an opaque raster result. A sprite can be read, validated, edited at exact coordinates, serialized as text, rendered deterministically, and reviewed through ordinary version-control tools.

A related problem appears when the source artwork is already a large raster image:

- A person wants to modify one small detail in a 1920×1080 or 2560×1440 image.
- Sending the entire image through an AI editing workflow can make a small requested change difficult to isolate and verify.
- Asking an AI to regenerate the whole image risks changing unrelated regions.
- A conventional raster file does not, by itself, provide a structured, reviewable description of the requested local edit.

An exploratory extension could combine an ordinary high-resolution image viewer with PIX2-style coordinate-addressable edits. The goal is not to turn every HD image into a giant PIX2 document. The goal is to let a person select a precise region, give an AI only the relevant visual context, and receive a small, verifiable patch that can be applied to the original image.

> **Working idea:** Keep the raster image as the source asset; represent the requested change as a coordinate-aware, machine-readable patch.

---

## 2. Concept: Coordinate-Aware AI Image Editing

A possible workflow:

1. **Open a raster source.** Display the original image at its native dimensions, independently of its on-screen zoom level.
2. **Inspect exact coordinates.** The viewer reports source-image coordinates under the cursor, not CSS or screen coordinates.
3. **Select a region of interest (ROI).** The user selects a rectangle or another supported region and may include a small context margin around it.
4. **Prepare AI context.** Send the selected crop, its source-image origin, dimensions, coordinate convention, and the user's editing instruction to a vision-capable AI tool.
5. **Receive a structured patch.** The AI proposes explicit changes relative to the selected region or the original image. The patch identifies its target asset and coordinate space.
6. **Validate before applying.** A patch processor checks the base asset, dimensions, bounds, operation types, and pixel values.
7. **Preview and apply.** Show a before/after comparison and let the user accept or reject the change. Pixels outside the authorized region remain unchanged unless the user explicitly permits a larger scope.

The AI is responsible for interpreting the visual request and proposing an edit. The patch processor is responsible for applying the returned operations exactly. Deterministic application does not imply that the AI's visual interpretation is always correct; human review remains essential.

---

## 3. Coordinate Model

The viewer must keep three coordinate spaces distinct:

| Space | Meaning | Persisted in an edit patch? |
|---|---|---|
| **Source-image coordinates** | Integer pixel positions in the original raster image | Yes |
| **ROI-local coordinates** | Integer positions relative to the selected crop | Optional, but the ROI origin must be recorded |
| **Screen coordinates** | CSS pixels after zoom, pan, and device scaling | No |

For a rectangular ROI with top-left origin `(originX, originY)`, local patch coordinates map to source-image coordinates as:

```text
sourceX = originX + localX
sourceY = originY + localY
```

The mapping must be independent of zoom, pan, browser device-pixel ratio, and display scaling. A pixel selected at source coordinate `(840, 320)` must remain that same source pixel at every zoom level.

Recommended conventions for an initial proposal:

- Origin at the top-left of the source image.
- Integer pixel coordinates; no fractional pixel addresses.
- Explicit source width and height.
- Half-open ROI rectangles: `[x0, x1) × [y0, y1)`.
- No implicit resampling during coordinate mapping.
- Any crop, resize, or transform used to prepare AI context must be recorded, with a reversible mapping back to the source image.

---

## 4. A Patch Is Not a Re-Generated Image

The important distinction is between returning a replacement image and returning a small set of declared operations.

Illustrative operations might include:

- Set a pixel to an exact RGBA value.
- Erase a pixel or make it transparent, where the target format supports alpha.
- Replace a color within an explicitly bounded region.
- Apply a bounded group of pixel edits.
- Optionally describe a mask or protected area that must not be changed.

This document does **not** define a finalized patch grammar or claim that these operations are implemented. A future proposal should decide whether patches are represented by a dedicated companion format, a versioned PIX2 extension, or another interoperable container.

A patch should ideally include:

- Target asset identifier and a content hash of the expected base image.
- Source dimensions and color mode.
- Coordinate origin and coordinate-space declaration.
- ROI bounds and any crop/resize transform.
- Explicit edit operations and exact color values.
- Optional provenance, tool, and author metadata.
- A format/version identifier.

The base-image hash is important: if the source image changes after the patch was created, the processor should reject the stale patch or require an explicit rebase rather than silently applying it to a different image.

---

## 5. Separation of Responsibilities

This idea should not force the PIX2 language core to become a general-purpose HD image editor.

A possible ecosystem separation is:

| Component | Responsibility |
|---|---|
| **PIX2 Core** | Canonical 2D pixel/sprite data model, grammar, parser, serializer, validation, and deterministic rendering rules |
| **Raster Viewer** | Native-resolution image display, zoom/pan, pixel inspection, and ROI selection |
| **Coordinate Mapper** | Converts viewer and crop coordinates into stable source-image coordinates |
| **AI Adapter** | Packages the selected crop and editing context for an external vision-capable model |
| **Patch Format / Patch Processor** | Describes, validates, previews, and applies bounded edits to a target asset |
| **Host Application** | Provides the user experience and manages files, review, undo, and export |

The parser and patch processor may be separate modules or separate implementations. Their responsibilities and resource limits should be documented independently. This keeps the existing sprite editor focused while allowing other developers to experiment with high-resolution workflows.

---

## 6. Relationship to PIX2 v1.0

This proposal is **not a claim that PIX2 v1.0 currently supports arbitrary Full HD documents**.

The current NOIRADIX implementation has explicit resource and coordinate limits. In particular, the current JavaScript parser defines:

- Parser payload guard: 20 × 1024 × 1024 JavaScript string code units (the source constant is labeled 20 MB).
- Maximum cell dimensions: 512 × 512.
- Maximum absolute coordinate: 2048.
- Maximum total cells: 4096.

Those are implementation limits, not proof of the maximum theoretical scope of every future PIX2 implementation. They must not be silently bypassed or interpreted as a promise of 1920×1080 support.

The HD viewer idea can keep the raster image outside the current PIX2 document model and use a separate patch layer. Any future attempt to extend PIX2 itself should be proposed as a versioned specification change with compatibility rules, security limits, and independent tests.

---

## 7. Determinism, Safety, and Review Requirements

Any future implementation should consider at least the following requirements:

1. **Exact source identity:** Reject patches whose base asset hash or declared dimensions do not match the target.
2. **Strict bounds:** Reject negative, out-of-range, malformed, or excessively large coordinates and operations.
3. **Region authorization:** Enforce the user-approved ROI unless the user explicitly approves changes outside it.
4. **No silent resampling:** Preserve exact pixel addresses and make any transform explicit.
5. **Deterministic application:** The same valid patch applied to the same base asset must produce the same output.
6. **Preview before commit:** Provide a visual diff and a clear list or count of changed pixels.
7. **Reversibility:** Preserve the original source and support undo or patch rollback.
8. **Resource controls:** Bound input size, operation count, ROI size, memory use, and processing time.
9. **Untrusted AI output:** Parse and validate patch data as untrusted input; never execute returned code or commands.
10. **Explicit failure:** On an invalid, stale, ambiguous, or partially out-of-bounds patch, fail safely instead of applying a truncated or guessed edit.

---

## 8. Open Research Questions

These questions are intentionally open for ecosystem contributors:

- Should the patch representation be a companion format such as a future PIX2PATCH, a versioned PIX2 module, or a transport-independent schema?
- Should a patch contain only explicit pixel operations, or also masks, paths, regions, and higher-level semantic annotations?
- How should edits to RGB images, RGBA images, indexed-color images, and images with color profiles be normalized without losing source fidelity?
- How should the system represent crop, resize, rotation, and other transforms while preserving exact source coordinates?
- What is the best way to package visual context for AI while keeping coordinate mapping unambiguous?
- How should multiple patches be merged, rebased, reviewed, and conflict-checked?
- Which parts belong in a language specification, and which belong in a separate viewer or application API?

---

## 9. Suggested Standardization Path

A responsible path for independent development could be:

1. Publish this as a non-normative research proposal.
2. Define a minimal patch data model without changing PIX2 v1.0.
3. Build independent parser/validator prototypes and publish test vectors.
4. Test exact coordinate mapping, stale-base detection, bounded application, and deterministic output.
5. Gather feedback from external tool authors and AI integration developers.
6. Only after the model is proven, consider a versioned companion specification or a formal PIX2 extension.

NOIRADIX Studio does not need to implement this direction for the idea to be useful. The proposal can serve as a research surface for contributors who want to explore the wider PIX2 ecosystem.

---

## 10. Core Principle

**Do not ask an AI to regenerate an entire image when the intended change is local.**

Preserve the original raster asset, isolate the visual context, express the requested modification as structured coordinate-addressable data, validate it, and apply it deterministically.

This extends the central PIX2 philosophy without changing its current focus:

> **Machines should work with explicit structure. Humans should remain in control of the visual result.**

