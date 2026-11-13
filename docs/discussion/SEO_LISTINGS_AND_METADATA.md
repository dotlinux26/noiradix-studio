# SEO metadata and listing links

## SEO-LISTINGS-01 — Accurate discovery metadata and directory links

- **Apps/surfaces:** Studio and PixelArt landing pages, About dialog, root README and documentation portal.
- **Repro:** Inspect the page titles and metadata, structured data version, or listing links in the About dialog and README.
- **Observed:** Studio metadata used an outdated title and an oversized keyword list with speculative terms and claims. Structured data reported software version `1.0`. PixelArt was missing a canonical URL and social preview metadata. The approved directory pages were split between the README footer and the Studio About dialog.
- **Expected:** Use concise, accurate page titles/descriptions; identify current app version; expose canonical/social URLs; make confirmed listings easy to find without suggesting a ranking guarantee.
- **Implementation:** Remove the obsolete `meta keywords` tag; update Studio and PixelArt titles/descriptions; update Studio `WebApplication` structured data (`softwareVersion` and `sameAs`); add PixelArt canonical/Open Graph/Twitter metadata; include PixelArt in `sitemap.xml`; list SourceForge, VibeCodePicks, TeaserTrack, AlternativeTo, SaaSCity, OpenHunts Club, Project Radar and Product Hunt in the README, docs portal and Studio About badge group.
- **Verification:** Follow-up on 2026-11-13: `node tests/run-all.cjs --syntax` passed (35 files), `node tests/run-all.cjs` passed (20 suites), benchmark gates passed, and `node tests/run-all.cjs --browser` passed all 3 suites. Chrome confirmed all 7 Studio About badges load and fit without horizontal overflow at 1440px and 390px viewport widths; no page errors or failed requests. The owner-edited `docs/noiradix-pix2-1.1.png` was preserved for this push.
- **Remaining coverage:** Third-party page markup, link attributes and search rankings are controlled by the listing services and search engines. Project Radar requires a visible homepage/page link to count its reciprocal link; its badge in the Studio About dialog is hidden until opened, so this update does not claim that its backlink checker will count it. External listing profiles were not edited.
