## 📌 Pull Request Overview

### Summary of Changes
<!-- Describe clearly what changes this PR introduces -->

### Motivation & Context
<!-- Why is this change required? What issue does it fix? -->
Fixes #(issue)

---

## 🔍 Change Category
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🎨 UI/UX refinement or styling improvement
- [ ] ⚡ Performance optimization
- [ ] 📝 Documentation update
- [ ] 🧪 Tests or validation suite update

---

## ✅ Invariant & Quality Checklist
Before submitting, please ensure your PR satisfies the core principles of NOIRADIX Studio:

- [ ] **Pure Vanilla Invariant:** Zero runtime dependencies, zero build steps, zero npm requirements. Runs directly in browser via `index.html`.
- [ ] **Artwork Preservation:** Does not wipe, erase, or corrupt existing canvas pixels during operations.
- [ ] **English Only:** All user-facing strings, tooltips, dialogs, comments, and documentation are strictly in English.
- [ ] **Deterministic Roundtrip:** Verified with `node tests/test-roundtrip.js` (must pass 23/23 tests).
- [ ] **Syntax Verification:** Verified clean with `node --check js/app.js` and `node --check js/pix2-format.js`.
- [ ] **Multi-Direction Engine Safe:** Frame and animation naming follows valid engine formats (`{action}_{direction}_{frame}`).

---

## 📸 Screenshots or Recordings (Optional)
<!-- Attach screenshots or animated GIFs demonstrating the change if applicable -->
