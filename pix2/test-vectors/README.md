# PIX2 Normative Test Vectors

This directory contains reference test vectors designed to verify the conformance of PIX2 parser and compiler implementations across programming languages (Rust, Python, Go, C#, C++, Zig, etc.).

---

## Conformance Criteria

A conforming PIX2 parser must satisfy the following requirements:

1. **Deterministic Parse Result**: Parsing `canonical_valid_hero.pix2` must produce an Abstract Syntax Tree (AST) semantically identical to `canonical_valid_hero.json`.
2. **Drawing Primitives Determinism**: Parsing `canonical_primitives_raster.pix2` must evaluate `line` (canonical integer Bresenham with tie-breaking), `rect` (fill/outline with boundary clipping), `fill` (4-way flood fill with diagonal isolation), `sym_dot` (cell-size aware reflection), and Last-Write-Wins (LWW) rules into exact pixels matching `canonical_primitives_raster.json`.
3. **Comment Disambiguation**: Hex colors (e.g. `#57546f`) must never be truncated or swallowed as comments, even when trailing comments follow on the same line.
4. **Strict Number Parsing**: Coordinate parsing must reject floats (`1.5`) and malformed alphanumeric tokens (e.g. `1abc,3`). Test vector: `invalid_syntax_coordinate.pix2`.
5. **Validation Integrity & Structured Diagnostics**:
   - `invalid_missing_frame.pix2` must be flagged by the validator due to referencing non-existent cell frames.
   - `invalid_out_of_bounds.pix2` must emit diagnostic code `PIX2_WARN_OUT_OF_BOUNDS` and report exact coordinate and cell metadata.

---

## Test Vector Index

| File | Type | Expected Behavior |
| :--- | :--- | :--- |
| `canonical_valid_hero.pix2` | Valid | Parses into `canonical_valid_hero.json` AST with zero warnings. |
| `canonical_valid_hero.json` | Baseline AST | Normative JSON representation of `canonical_valid_hero.pix2`. |
| `canonical_primitives_raster.pix2` | Vector Primitives | Tests Bresenham line tie-breaking, rect fill/outline, 4-way flood fill, sym_dot custom sizing, and LWW overwrite rules. |
| `canonical_primitives_raster.json` | Baseline Raster | Expected pixel AST representation of `canonical_primitives_raster.pix2`. |
| `canonical_v11_opacity.pix2` | PIX2 1.1 structural | Layer children stay in order `below, g, above`. Expected composite pixels are `0,0 #3800c790` and `1,0 #ff000010`. The zero-opacity Region contributes no color. |
| `invalid_syntax_coordinate.pix2` | Invalid Syntax | Rejects non-integer coordinate `1abc,3`. |
| `invalid_missing_frame.pix2` | Invalid Semantics | Validator flags missing frame reference `phantom_cell_404`. |
| `invalid_out_of_bounds.pix2` | Security Violation | Validator flags coordinates outside cell bounds in strict mode with `PIX2_WARN_OUT_OF_BOUNDS`. |
