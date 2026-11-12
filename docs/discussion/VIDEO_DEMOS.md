# NOIRADIX video demos

## VIDEO-01 — Keep both product demos discoverable

- **Apps/surfaces:** Studio About dialog, root README, documentation portal.
- **Repro:** Open the About dialog or either README visual-tour section.
- **Expected:** The PIX2/AI authoring demo and the Unity 2D export/import demo are both available as distinct links with clear labels.
- **Implementation:** Keep `https://www.youtube.com/watch?v=XikhVI0APQg` with the title “AI Programming Your Pixel Art Spritesheet Animation with PIX2 language?! | NOIRADIX Studio Demo”; keep `https://youtu.be/onD4kSF_uTc` for the Unity export/import workflow. Do not replace one with the other.
- **Verification:** Confirmed both links and labels in both READMEs and the Studio About dialog; release CI runs the browser suites for both app entry points.
- **Remaining coverage:** Visual appearance of the two About links has not been manually inspected in this update.
