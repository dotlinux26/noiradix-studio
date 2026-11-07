# Contributing to NOIRADIX Studio

First off, thank you for considering contributing to **NOIRADIX Studio**! It's people like you that make game development tools better for everyone.

Following these guidelines helps keep our codebase lean, deterministic, and pure vanilla.

---

## 🏛️ Core Architectural Invariants

Every contribution must honor our design pillars:

1. **Pure Vanilla Web Stack:**
   * **Zero build steps.** No Webpack, Vite, Rollup, Babel, or bundling pipelines.
   * **Zero runtime dependencies.** No frameworks (React, Vue, Svelte). Everything is plain, clean ES6+ JavaScript.
   * Double-clicking `index.html` or executing `start-noiradix-studio.bat` must always work out of the box.

2. **100% English Standards:**
   * All UI text, tooltips, dialogs, console messages, comments, and documentation must be written in English.

3. **Deterministic Pixel Roundtrip:**
   * Parsing a `.pix2` document and serializing it back must be completely deterministic.
   * Never drop or alter hex colors or sparse transparent regions.

4. **100% User Artwork Preservation:**
   * Grid dimension updates, direction generation, or cell actions must never erase drawn pixels without explicit confirmation.

---

## 🛠️ Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/noiradix-studio.git
cd noiradix-studio
```

### 2. Local Testing
Serve locally using any standard static HTTP server or open directly:
```bash
# Python
python -m http.server 8080

# Or Node.js
npx serve .
```

### 3. Run Automated Tests
Before committing, always run all test suites:
```bash
# 1. Semantic roundtrip & feature tests
node tests/test-roundtrip.js

# 2. Security & Anti-DoS tests
node tests/test-security.js

# 3. TextMate grammar validation
node tests/test-tmLanguage.js

# 4. Normative test vector conformance
node tests/test-vectors-conformance.js
```
And check JavaScript syntax:
```bash
node --check js/app.js
node --check js/pix2-format.js
node --check js/tools.js
node --check js/editor-state.js
node --check pix2/js/pix2-format.js
```

---

## 🌿 Git Workflow

1. Create a descriptive branch from `main`:
   ```bash
   git checkout -b feature/anti-bleed-padding
   ```
2. Commit your changes using conventional commit messages:
   ```bash
   feat: add godot 4 spriteframes export preset
   fix: resolve line tool preview jitter on symmetry mode
   docs: update keybindings table
   ```
3. Push to your fork and submit a Pull Request targeting `main`.

---

## 💖 Community & Code of Conduct

This project is led by **dotlinux26 (Nguyen Duc Canh)**. Please note that all participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

If you have questions or want to discuss ideas, please open a discussion on GitHub or reach out to `0206canh@gmail.com`.

