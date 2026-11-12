# PixelArt PIX2 import and listing updates

**Baseline:** `312df54` (`main`, NOIRADIX 2.1.4)

## PA-IMPORT-CODE-01 — Create artwork tab from pasted PIX2

- **App:** NOIRADIX PixelArt
- **Repro:** Open `/pixelart/`, choose **Import PIX2**, paste a PIX2 document, and confirm.
- **Observed:** PixelArt can open `.pix2` files and edit code in the live pane, but has no dedicated paste-import action that creates a separate artwork tab.
- **Expected:** Valid source opens as an independent editable tab; invalid source reports a clear error and leaves current tabs untouched.
- **Implementation:** Add a paste dialog using the shared PIX2 parser and PixelArt validation profile. Accept plain source and common fenced `pix2` blocks. Persist the new tab through the existing workspace lifecycle; it remains a draft until saved to disk.
- **Verification:** `node tests/run-all.cjs --syntax` passed (35 files); `node tests/run-all.cjs` passed (20 suites). Browser interaction checks were skipped at the user's request.
- **Remaining coverage:** Browser review of valid/fenced/malformed source, project switching, autosave/reload, and existing unsaved artwork preservation remains optional follow-up.

## PA-ABOUT-CONTRAST-01 — About metadata readability

- **App:** NOIRADIX PixelArt
- **Repro:** Open the About modal in light theme.
- **Observed:** The metadata card background and muted labels have weak contrast in light theme.
- **Expected:** Card background, labels, and domain link remain readable in both light and dark themes.
- **Implementation:** Use theme-aware surface, text, and link tokens for the metadata card.
- **Verification:** Included in the passing 35-file syntax check and 20 Node suites; visual browser review was skipped at the user's request.
- **Remaining coverage:** Visual check of narrow modal width and dark theme remains optional follow-up.

## LAUNCH-LINKS-01 — Approved directory listings and current demo

- **App:** NOIRADIX Studio website and project documentation
- **Repro:** Open the About modal or either project README.
- **Observed:** New approved listings and the corrected Unity 2D demo URL were missing; the TeaserTrack link was a static placeholder badge.
- **Expected:** Show the official TeaserTrack badge and AlternativeTo badge, link to the approved listing pages, and use the owner's corrected YouTube video.
- **Implementation:** Add official listing badges to the Studio About modal and README headers; retain both the PIX2/AI authoring demo (`XikhVI0APQg`) and Unity export/import demo (`onD4kSF_uTc`). See [VIDEO_DEMOS.md](VIDEO_DEMOS.md) for the correction after the PIX2 link was accidentally removed.
- **Verification:** Source now uses the official badge and listing URLs provided by the user; browser rendering was skipped at the user's request.
- **Remaining coverage:** Confirm TeaserTrack's badge checker detects the backlink after deployment.

## MAINTENANCE-INTERVAL-01 — Longer dismissal interval

- **App:** NOIRADIX Studio and PixelArt maintenance banner
- **Repro:** Dismiss the maintenance notice and wait for the configured interval.
- **Observed:** The banner is eligible to reappear after 30 minutes.
- **Expected:** Recheck after 3 hours.
- **Implementation:** Change the default interval and visible countdown copy to 3 hours.
- **Verification:** The updated three-hour interval assertion passed in the 20-suite Node run.
- **Remaining coverage:** Runtime dismissal/reappearance timing was not browser-tested at the user's request.
