# Working in NOIRADIX

- Studio owns sprite sheets, frame editing, animation and atlas import. PixelArt owns the standalone artwork canvas. Put PIX2 parsing, raster operations and editor rules shared by both apps in `js/`. Keep DOM, viewport, history and autosave wiring in each app.
- Start with `PIX2_SPECIFICATION.md`, `docs/ARCHITECTURE.md` and the relevant interaction spec. Treat discussion notes, screenshots and prior agent reports as evidence to check against the current checkout.
- Keep static deployment and PIX2 1.0 read compatibility. Verify new PIX2 1.1 behavior through load, edit, undo, export and reload. View state such as zoom and isolation must stay out of exported artwork.
- Record cross-app work in `docs/discussion/`. For each finding, include the app, repro, expected behavior, implementation status and verification evidence. Update the note when a behavior decision or test result changes.
- Run all `tests/test-*.js` files with Node. For UI changes, also exercise the normal entry points in a browser in both affected apps. Cover overlap, locked or hidden ancestors, Escape, canvas boundaries and project or frame switches where relevant.
- For review handoff, state the checks actually run and any remaining gaps. Update the normative product or format spec when its contract changes.
