# SEO metadata and listing links

## SEO-LISTINGS-01 — Accurate discovery metadata and directory links

- **Apps/surfaces:** Studio and PixelArt landing pages, About dialog, root README and documentation portal.
- **Repro:** Inspect the page titles and metadata, structured data version, or listing links in the About dialog and README.
- **Observed:** Studio metadata used an outdated title and an oversized keyword list with speculative terms and claims. Structured data reported software version `1.0`. PixelArt was missing a canonical URL and social preview metadata. The approved directory pages were split between the README footer and the Studio About dialog.
- **Expected:** Use concise, accurate page titles/descriptions; identify current app version; expose canonical/social URLs; make the four confirmed listings easy to find without suggesting a ranking guarantee.
- **Implementation:** Remove the obsolete `meta keywords` tag; update Studio and PixelArt titles/descriptions; update Studio `WebApplication` structured data (`softwareVersion` and `sameAs`); add PixelArt canonical/Open Graph/Twitter metadata; include PixelArt in `sitemap.xml`; place SourceForge, VibeCodePicks, TeaserTrack and AlternativeTo links/badges immediately below the README Verdict and in Studio About.
- **Verification:** `node tests/run-all.cjs --syntax` passed (35 files); `node tests/run-all.cjs` passed (20 suites); `node tests/benchmark-performance.js` passed all performance gates; `node tests/run-all.cjs --browser` passed all 3 browser suites for Studio and PixelArt (including the UI flow and dense grid coverage); `git diff --check` passed. Studio and PixelArt page metadata and the Studio listing badge URLs were also inspected in Chrome.
- **Remaining coverage:** Third-party page markup, link attributes and search rankings are controlled by the listing services and search engines. Website badges provide outbound navigation; they do not guarantee followed inbound links or ranking gains. TeaserTrack's current policy describes directory links as `nofollow ugc` unless its badge checker observes the badge. No changes are made to external listing profiles in this repository update.
