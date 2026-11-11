/** Studio source controller. App supplies document and view ports. */
const StudioSource = (() => {
  function create({ state, dom, view, escapeHtml, refreshAll, showToast, triggerEventAutosave }) {
function splitLineComment(rawLine) {
    if (!rawLine) return { code: '', comment: '' };
    const semiIdx = rawLine.indexOf(';');
    const text = (semiIdx >= 0 ? rawLine.slice(0, semiIdx) : rawLine);
    let comment = (semiIdx >= 0 ? rawLine.slice(semiIdx) : '');

    let code = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' || ch === "'") inQuote = !inQuote;
      if (!inQuote && ch === '#') {
        const rest = text.slice(i);
        const hexMatch = rest.match(/^#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?=[\s,;"']|$)/);
        if (hexMatch) {
          code += hexMatch[0];
          i += hexMatch[0].length - 1;
          continue;
        } else {
          comment = text.slice(i) + comment;
          break;
        }
      }
      code += ch;
    }
    return { code, comment };
  }

function highlightPix2Code(code) {
    if (!code) return '';
    const lines = code.split('\n');
    return lines.map((line, idx) => {
      const { code: codePart, comment: commentPart } = splitLineComment(line);

      let html = escapeHtml(codePart);

      // 1. Strings (mask to avoid token collision)
      const strMap = [];
      html = html.replace(/(&quot;.*?&quot;|"[^"]*"|'[^']*')/g, (m) => {
        strMap.push('<span class="syn-str">' + m + '</span>');
        return '___PIXSTR_' + (strMap.length - 1) + '___';
      });

      // 2. Hex colors with color preview dot swatch (mask before number detection to prevent numeric hex like #080610 corruption)
      const colMap = [];
      html = html.replace(/(#[0-9a-fA-F]{3,8})\b/g, (m) => {
        colMap.push('<span class="syn-color"><span class="syn-swatch" style="background-color:' + m + '"></span>' + m + '</span>');
        return '___PIXCOL_' + (colMap.length - 1) + '___';
      });

      // 3. Section directives (@meta, @grid, @palette, @cell, etc.)
      html = html.replace(/(@[a-zA-Z0-9_]+)/g, '<span class="syn-dir">$1</span>');

      // 4. Keys followed by colon (key:) - mask to protect key names and colon
      const keyMap = [];
      html = html.replace(/\b([a-zA-Z0-9_]+):/g, (_, k) => {
        keyMap.push('<span class="syn-key">' + k + ':</span>');
        return '___PIXKEY_' + (keyMap.length - 1) + '___';
      });

      // 5. Drawing commands & vector macros
      html = html.replace(/\b(sym_dot|line|rect|fill|pixel|dot)\b/g, '<span class="syn-cmd">$1</span>');
      html = html.replace(/(^|\s)(p)(?=\s|$)/g, '$1<span class="syn-cmd">$2</span>');

      // 6. Keywords
      html = html.replace(/\b(true|false|loop|once|outline|none|down|up|right|left|down_right|down_left|up_right|up_left)\b/g, '<span class="syn-kw">$1</span>');

      // 7. Numbers, dimensions, coordinates (outside tags & tokens)
      html = html.replace(/\b(\d+(?:,\d+|\.\d+|x\d+)?)\b(?![^<]*>)/g, '<span class="syn-num">$1</span>');

      // 8. Restore tokens safely in reverse order
      html = html.replace(/___PIXKEY_(\d+)___/g, (_, i) => keyMap[i]);
      html = html.replace(/___PIXCOL_(\d+)___/g, (_, i) => colMap[i]);
      html = html.replace(/___PIXSTR_(\d+)___/g, (_, i) => strMap[i]);

      if (commentPart) {
        html += '<span class="syn-cmt">' + escapeHtml(commentPart) + '</span>';
      }

      const lineNum = '<span class="line-num">' + (idx + 1) + '</span>';
      return '<div class="code-line">' + lineNum + '<span class="line-content">' + (html || ' ') + '</span></div>';
    }).join('');
  }

function renderCodeEditor() {
    if (!state.doc) return;

    if (!view.isCodeEditingUnlocked) {
      const serialized = PIX2.serialize(state.doc);
      if (dom.codeTextarea) dom.codeTextarea.value = serialized;
      if (dom.codeViewer) {
        dom.codeViewer.innerHTML = highlightPix2Code(serialized);
        dom.codeViewer.classList.remove('hidden');
      }
      if (dom.codeTextarea) {
        dom.codeTextarea.classList.add('hidden');
        dom.codeTextarea.readOnly = true;
      }
      if (dom.codeModeBadge) {
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i> View Only';
        dom.codeModeBadge.className = 'badge badge-subtle';
      }
      if (dom.btnToggleEditCode) {
        dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Code';
        dom.btnToggleEditCode.classList.remove('btn-warning');
        dom.btnToggleEditCode.classList.add('btn-secondary');
        dom.btnToggleEditCode.title = 'Unlock to edit PIX2 code manually';
      }
      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.add('hidden');
      }
    }
    updateAiGuidePane(dom.selectAiPromptMode ? dom.selectAiPromptMode.value : 'all-in-one');
  }

function lockCodeEditingSilently() {
    view.isCodeEditingUnlocked = false;
    if (dom.codeTextarea) {
      dom.codeTextarea.classList.add('hidden');
      dom.codeTextarea.readOnly = true;
      dom.codeTextarea.classList.remove('editing-active');
    }

    if (dom.codeViewer && state.doc) {
      const serialized = PIX2.serialize(state.doc);
      if (dom.codeTextarea) dom.codeTextarea.value = serialized;
      dom.codeViewer.innerHTML = highlightPix2Code(serialized);
      dom.codeViewer.classList.remove('hidden');
    }

    if (dom.btnToggleEditCode) {
      dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Code';
      dom.btnToggleEditCode.classList.remove('btn-warning');
      dom.btnToggleEditCode.classList.add('btn-secondary');
      dom.btnToggleEditCode.title = 'Unlock to edit PIX2 code manually';
    }

    if (dom.codeModeBadge) {
      dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i> View Only';
      dom.codeModeBadge.className = 'badge badge-subtle';
    }

    if (dom.btnApplyCode) {
      dom.btnApplyCode.classList.add('hidden');
    }
  }

function handleBeforeLeaveCodeTab() {
    if (!view.isCodeEditingUnlocked || !dom.codeTextarea || !state.doc) return true;
    const currentDocCode = PIX2.serialize(state.doc);
    const textareaCode = dom.codeTextarea.value;
    if (textareaCode.trim() === currentDocCode.trim()) {
      lockCodeEditingSilently();
      return true;
    }

    const wantApply = confirm(
      '⚠️ UNAPPLIED CODE EDITS DETECTED:\n\n' +
      'You have manual modifications in the PIX2 Code Editor that have not been applied to the project.\n\n' +
      '• Click OK to APPLY edits to canvas and continue.\n' +
      '• Click Cancel to DISCARD edits and switch tabs.'
    );

    if (wantApply) {
      try {
        const parsed = PIX2.parseValidated(textareaCode);
        state.setDocument(parsed, true);
        state.saveSnapshot('Apply Code');
        triggerEventAutosave();
        lockCodeEditingSilently();
        showToast('Applied PIX2 code edits to project!', 'success');
        return true;
      } catch (err) {
        alert(`Cannot switch tab: PIX2 code contains syntax errors:\n${err.message}\n\nPlease fix the errors or click Cancel to discard.`);
        return false;
      }
    } else {
      // Discard edits and lock back to safe AST view
      lockCodeEditingSilently();
      showToast('Unapplied code edits discarded.', 'info');
      return true;
    }
  }

function toggleCodeEditMode() {
    if (!dom.codeTextarea) return;

    if (!view.isCodeEditingUnlocked) {
      const confirmed = confirm(
        '⚠️ DIRECT CODE EDITING WARNING:\n\n' +
        'Manually modifying PIX2 code can corrupt sprite syntax or desynchronize animation sequences if the format grammar is not followed accurately.\n\n' +
        '💡 RECOMMENDED: Use your AI Copilot!\n' +
        'Click "Copy for AI Prompt" or "Copy PIX2 Code" to let an AI modify the code safely and intelligently.\n\n' +
        'Are you sure you want to unlock direct code editing?'
      );
      if (!confirmed) return;

      view.isCodeEditingUnlocked = true;
      if (dom.codeViewer) dom.codeViewer.classList.add('hidden');
      if (dom.codeTextarea) {
        dom.codeTextarea.classList.remove('hidden');
        dom.codeTextarea.readOnly = false;
        dom.codeTextarea.classList.add('editing-active');
        dom.codeTextarea.focus();
      }

      if (dom.btnToggleEditCode) {
        dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-lock"></i> Lock Code';
        dom.btnToggleEditCode.classList.remove('btn-secondary');
        dom.btnToggleEditCode.classList.add('btn-warning');
        dom.btnToggleEditCode.title = 'Lock code and revert to safe syntax viewer';
      }

      if (dom.codeModeBadge) {
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-pen"></i> Direct Editing Active';
        dom.codeModeBadge.className = 'badge badge-warning';
      }

      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.remove('hidden');
      }

      showToast('Direct code editing enabled. Click "Apply to Canvas" to commit changes.', 'warning');
    } else {
      // Check for unapplied code edits before locking
      if (dom.codeTextarea && state.doc) {
        const currentDocCode = PIX2.serialize(state.doc);
        if (dom.codeTextarea.value.trim() !== currentDocCode.trim()) {
          const wantApply = confirm(
            '⚠️ UNAPPLIED CODE EDITS DETECTED:\n\n' +
            'You have modified PIX2 code that has not been applied to the canvas.\n\n' +
            '• Click OK to apply your edits now and lock safely.\n' +
            '• Click Cancel to discard edits and revert to canvas state.'
          );
          if (wantApply) {
            applyCodeToDoc();
            return;
          }
        }
      }

      lockCodeEditingSilently();
      showToast('Code locked in safe syntax view mode.', 'info');
    }
  }

function copyRawPix2Code() {
    if (!state.doc) return;
    const code = (view.isCodeEditingUnlocked && dom.codeTextarea && state.activeTabId === 'tab-pix2-code')
      ? dom.codeTextarea.value
      : PIX2.serialize(state.doc);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('Copied raw .PIX2 code to clipboard!', 'success');
      }).catch(() => {
        fallbackCopyText(code);
      });
    } else {
      fallbackCopyText(code);
    }
  }

function fallbackCopyText(text) {
    const tempTa = document.createElement('textarea');
    tempTa.value = text;
    tempTa.style.position = 'fixed';
    tempTa.style.opacity = '0';
    document.body.appendChild(tempTa);
    tempTa.select();
    try {
      document.execCommand('copy');
      showToast('Copied raw .PIX2 code to clipboard!', 'success');
    } catch (e) {
      alert('Could not copy automatically. You can copy the code manually.');
    }
    document.body.removeChild(tempTa);
  }

function applyCodeToDoc() {
    if (!dom.codeTextarea) return;
    try {
      const code = dom.codeTextarea.value;
      const newDoc = PIX2.parseValidated(code);
      state.setDocument(newDoc, true);
      state.saveSnapshot('Apply Code');
      triggerEventAutosave();

      // Automatically lock code editing after successful apply for safety
      lockCodeEditingSilently();

      refreshAll();
      showToast('PIX2 Code parsed & applied to canvas successfully!', 'success');
    } catch (err) {
      alert(`Error parsing PIX2 code:\n${err.message}`);
    }
  }

function getSpriteMath(cw, ch) {
    cw = Math.min(Math.max(1, parseInt(cw, 10) || 16), 512);
    ch = Math.min(Math.max(1, parseInt(ch, 10) || 16), 512);
    const axisX = (cw - 1) / 2;
    const axisXStr = axisX.toFixed(1);

    // Dynamic vertical landmarks proportional to canvas height
    const topMargin = Math.max(1, Math.round(ch * 0.05));
    const headEndY = Math.max(topMargin + 3, Math.round(ch * 0.38));
    const eyeStartY = Math.max(topMargin + 2, Math.round(ch * 0.28));
    const eyeEndY = Math.min(headEndY - 1, Math.round(ch * 0.36));
    const torsoStartY = headEndY + 1;
    const torsoEndY = Math.max(torsoStartY + 3, Math.round(ch * 0.72));
    const legsStartY = torsoEndY + 1;
    const legsEndY = Math.max(legsStartY + 1, ch - 2);
    const groundY = ch - 1;

    // Dynamic horizontal widths & bounds proportional to canvas width
    const bodyW = Math.max(6, Math.round(cw * 0.65));
    const startX = Math.floor((cw - bodyW) / 2);
    const endX = startX + bodyW - 1;

    const headW = Math.max(6, Math.round(cw * 0.55));
    const headStartX = Math.floor((cw - headW) / 2);
    const headEndX = headStartX + headW - 1;

    const eyeOffset = Math.max(1, Math.round(cw * 0.12));
    const eyeLeftX = Math.round(axisX - eyeOffset - 0.5);
    const eyeRightX = Math.round(axisX + eyeOffset + 0.5);

    return {
      cw, ch, axisX, axisXStr,
      head: { y: [topMargin, headEndY], w: headW, x: [headStartX, headEndX] },
      eyes: { y: [eyeStartY, eyeEndY], leftX: eyeLeftX, rightX: eyeRightX },
      torso: { y: [torsoStartY, torsoEndY], w: bodyW, x: [startX, endX] },
      legs: { y: [legsStartY, legsEndY] },
      groundY
    };
  }

function updateAiGuidePane(mode = 'all-in-one') {
    const titleEl = document.getElementById('ai-guide-title');
    const contentEl = document.getElementById('ai-guide-content');
    if (!contentEl) return;

    const cw = (state.doc && state.doc.meta && state.doc.meta.cellSize) ? state.doc.meta.cellSize.w : 16;
    const ch = (state.doc && state.doc.meta && state.doc.meta.cellSize) ? state.doc.meta.cellSize.h : 16;
    const m = getSpriteMath(cw, ch);

    const canonicalTableHtml = `
      <table class="guide-table">
        <thead>
          <tr>
            <th>Cell Resolution</th>
            <th>Valid Coords</th>
            <th>Center Axis (axisX)</th>
            <th>Bilateral Symmetry Macro</th>
            <th>Reflection Math</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>16 × 16</strong></td>
            <td>0 to 15</td>
            <td><code>X = 7.5</code></td>
            <td><code>sym_dot x,y 7.5 &lt;color&gt;</code></td>
            <td><code>x' = 15 - x</code></td>
          </tr>
          <tr>
            <td><strong>24 × 24</strong></td>
            <td>0 to 23</td>
            <td><code>X = 11.5</code></td>
            <td><code>sym_dot x,y 11.5 &lt;color&gt;</code></td>
            <td><code>x' = 23 - x</code></td>
          </tr>
          <tr>
            <td><strong>32 × 32</strong></td>
            <td>0 to 31</td>
            <td><code>X = 15.5</code></td>
            <td><code>sym_dot x,y 15.5 &lt;color&gt;</code></td>
            <td><code>x' = 31 - x</code></td>
          </tr>
          <tr>
            <td><strong>64 × 64</strong></td>
            <td>0 to 63</td>
            <td><code>X = 31.5</code></td>
            <td><code>sym_dot x,y 31.5 &lt;color&gt;</code></td>
            <td><code>x' = 63 - x</code></td>
          </tr>
          <tr>
            <td><strong>W × H (Custom)</strong></td>
            <td>0..W-1, 0..H-1</td>
            <td><code>axisX = (W-1)/2</code></td>
            <td><code>sym_dot x,y axisX &lt;color&gt;</code></td>
            <td><code>x' = (W - 1) - x</code></td>
          </tr>
        </tbody>
      </table>
    `;

    const activeBoundsBoxHtml = `
      <div class="guide-formula-box" style="border-left: 3px solid #3b82f6; margin-bottom: 10px;">
        <p><strong>🎯 Active Canvas (${cw}×${ch}):</strong> Center Axis <code>axisX = ${m.axisXStr}</code></p>
        <p><strong>Head &amp; Hair:</strong> Y = ${m.head.y[0]}..${m.head.y[1]}, X = ${m.head.x[0]}..${m.head.x[1]} (Width ~ ${m.head.w}px)</p>
        <p><strong>Eyes:</strong> Y = ${m.eyes.y[0]}..${m.eyes.y[1]} (Left: X ≈ ${m.eyes.leftX}, Right: X ≈ ${m.eyes.rightX})</p>
        <p><strong>Torso / Outfit / Armor:</strong> Y = ${m.torso.y[0]}..${m.torso.y[1]}, X = ${m.torso.x[0]}..${m.torso.x[1]} (Width ~ ${m.torso.w}px)</p>
        <p><strong>Legs / Ghost Wisps:</strong> Y = ${m.legs.y[0]}..${m.legs.y[1]}</p>
        <p><strong>Ground Shadow / Clearance:</strong> Y = ${m.groundY} (Bottom boundary)</p>
      </div>
    `;

    if (mode === 'all-in-one') {
      if (titleEl) titleEl.textContent = '🌟 All-in-One Master Cognitive Guide (Complete Reference)';
      contentEl.innerHTML = `
        <h4>1. Canonical Coordinate &amp; Bilateral Symmetry Reference Table</h4>
        ${canonicalTableHtml}

        <h4>2. Live Computed Anatomy Landmarks for Active Canvas (${cw}×${ch})</h4>
        ${activeBoundsBoxHtml}

        <h4>3. Solid Sprite Mass Mandate (Strictly No Hollow Wireframes)</h4>
        <div class="guide-formula-box" style="border-left: 3px solid #ef4444;">
          <p><strong>Mandatory Solid Interior:</strong> Pixel art sprites are solid physical entities with volume, NOT hollow wireframes! The interior of the head, face, torso, clothing, and limbs MUST be 100% packed with solid color pixels.</p>
          <p><strong>Transparent Boundary:</strong> Transparent pixels exist ONLY in the open air outside the character silhouette.</p>
          <p><strong>Fast Solid Filling:</strong> Use <code>rect x,y w,h &lt;col&gt; fill</code> to instantly pack torso/cape blocks in 1 line! Use <code>sym_dot</code> to plot horizontal rows symmetrically.</p>
        </div>

        <h4>4. Mathematical Primitives &amp; Vector Macros in PIX2</h4>
        <ul class="guide-cmd-list">
          <li><code>p x,y &lt;pal_id|hex&gt;</code> — Plot single pixel (inline chaining supported: <code>p 5,2 1  p 6,2 2</code>)</li>
          <li><code>sym_dot x,y axisX &lt;col&gt;</code> — Automatic bilateral mirror reflection (axisX = ${m.axisXStr})</li>
          <li><code>rect x,y w,h &lt;col&gt; fill</code> — Solid rectangular fill (chest, body, robes)</li>
          <li><code>rect x,y w,h &lt;col&gt; outline</code> — Rectangular bounding box (shields, borders)</li>
          <li><code>line x0,y0 x1,y1 &lt;col&gt;</code> — Bresenham discrete line (swords, staves, diagonal edges)</li>
          <li><code>fill x,y &lt;col&gt;</code> — 4-way bounded flood fill</li>
        </ul>

        <h4>5. Anti-Lazy 4-Frame Locomotion Formulas</h4>
        <ul class="guide-cmd-list">
          <li><strong>Frame 0 (Contact / Hover High):</strong> Baseline standing or hovering pose, grounded at Y = ${m.legs.y[1]}.</li>
          <li><strong>Frame 1 (Step Left / Sway Right Dip):</strong> Torso bobs Y±1, left foot forward. For floating: tail wisps curl right (+1..+2px X).</li>
          <li><strong>Frame 2 (Passing / Hover Low):</strong> Feet cross center axis. Ghost tail elongates, glowing eyes pulse brighter.</li>
          <li><strong>Frame 3 (Step Right / Sway Left Dip):</strong> Torso bobs Y±1, right foot forward. For floating: tail wisps curl left (-1..-2px X).</li>
          <li><strong>Secondary Motion:</strong> Cloaks, hair tails, and ethereal wisps MUST lag 1 frame behind primary body motion.</li>
        </ul>

        <h4>6. Directional Perspective Standards</h4>
        <div class="guide-formula-box">
          <p><strong>Down:</strong> Frontal perspective. Perfect bilateral symmetry on <code>axisX = ${m.axisXStr}</code>. Both eyes visible.</p>
          <p><strong>Up:</strong> Back perspective. Center symmetry on <code>axisX = ${m.axisXStr}</code>. NO eyes, nose, or mouth (hair and cloak only).</p>
          <p><strong>Right:</strong> 3/4 profile facing right. Face and chest shifted towards right margin.</p>
          <p><strong>Left:</strong> Exact mathematical mirror of Right: <code>x_left = (${cw - 1}) - x_right</code>.</p>
        </div>

        <div class="tip-box">
          <i class="fa-solid fa-palette"></i>
          <span><strong>Cohesive 5-6 Tone Palette:</strong> 1: Outline Dark Slate &bull; 2: Deep Core Shadow &bull; 3: Midtone Body &bull; 4: Rim Highlight &bull; 5: Glowing Eyes &bull; 6: Accent Trim.</span>
        </div>
      `;
    } else if (mode === 'full-character') {
      if (titleEl) titleEl.textContent = '🧙‍♂️ Full Character (4-Dir / 8-Dir Generation)';
      contentEl.innerHTML = `
        <h4>1. Coordinate &amp; Symmetry Reference Table (${cw}×${ch})</h4>
        ${canonicalTableHtml}
        ${activeBoundsBoxHtml}

        <h4>2. Solid Sprite Mass Mandate</h4>
        <p class="guide-desc">The interior of the head, torso, clothing, and limbs MUST be 100% packed with solid color pixels. Never output an empty wireframe!</p>

        <h4>3. Directional Frame Mapping</h4>
        <ul class="guide-cmd-list">
          <li><code>down_0..3</code>: Front facing (bilateral symmetry, axisX = ${m.axisXStr}, 2 eyes visible)</li>
          <li><code>up_0..3</code>: Back view (bilateral symmetry, axisX = ${m.axisXStr}, hair/cloak only, 0 eyes)</li>
          <li><code>right_0..3</code>: Profile facing right (3/4 angle, eyes/nose facing right)</li>
          <li><code>left_0..3</code>: Exact horizontal mirror of Right: <code>x_left = ${cw - 1} - x_right</code></li>
        </ul>
      `;
    } else if (mode === 'walk-animation') {
      if (titleEl) titleEl.textContent = '🎬 Walk & Float Animation Engine';
      contentEl.innerHTML = `
        <h4>1. Mathematical 4-Frame Locomotion Formulas</h4>
        <div class="guide-formula-box">
          <p><strong>Frame 0 (Neutral):</strong> Neutral standing or hovering baseline pose.</p>
          <p><strong>Frame 1 (Step Left / Sway Right):</strong> Torso bobs Y±1, left foot steps forward or tail wisps sway right.</p>
          <p><strong>Frame 2 (Passing / Low Dip):</strong> Feet pass center axis or ghost tail elongates vertically.</p>
          <p><strong>Frame 3 (Step Right / Sway Left):</strong> Torso bobs Y±1, right foot steps forward or tail wisps sway left.</p>
        </div>

        <h4>2. Secondary Motion Physics</h4>
        <p class="guide-desc">Trailing capes, hair tails, antennae, and magical floating wisps MUST lag 1 frame behind body movement for fluid organic motion.</p>
      `;
    } else if (mode === 'accessory-equipment') {
      if (titleEl) titleEl.textContent = '🗡️ Equipment & Accessory Overlay';
      contentEl.innerHTML = `
        <h4>1. Equipment Attachment Zones on Canvas (${cw}×${ch})</h4>
        <div class="guide-formula-box">
          <p><strong>Hats / Helmets / Crowns:</strong> Top crown Y = 0 to ${m.head.y[0] + 3}</p>
          <p><strong>Weapons (Swords / Staves / Bows):</strong> Hand level X = 1..${m.torso.x[0]} or ${m.torso.x[1]}..${cw - 1}, Y = ${m.torso.y[0]}..${m.torso.y[1]}</p>
          <p><strong>Cloaks / Wings / Shields:</strong> Flanking sides X = 0..${m.torso.x[0]} and ${m.torso.x[1]}..${cw - 1}</p>
        </div>
        <h4>2. Weapon Drawing Directives</h4>
        <p class="guide-desc">Use <code>line x0,y0 x1,y1 &lt;col&gt;</code> for diagonal sword blades and staff shafts.</p>
      `;
    } else if (mode === 'surgical-patch') {
      if (titleEl) titleEl.textContent = '🩹 Surgical Frame / Color Patch';
      contentEl.innerHTML = `
        <h4>1. Surgical Frame-Level Addressing</h4>
        <p class="guide-desc">Output ONLY the specific <code>@cell &lt;id&gt;</code> or <code>@palette</code> directives that need changes, keeping all other frames untouched to save tokens and prevent regressions.</p>
        <pre><code>; Recolor eyes to Glowing Cyan
@cell cell_0_0
  p ${m.eyes.leftX},${m.eyes.y[0]} #00ffff  p ${m.eyes.rightX},${m.eyes.y[0]} #00ffff</code></pre>
      `;
    } else {
      if (titleEl) titleEl.textContent = '📋 Studio Architecture & Programmatic API';
      contentEl.innerHTML = `
        <h4>1. NOIRADIX Studio Overview</h4>
        <p class="guide-desc">A coordinate-addressed pixel art editor with live disk hot-reloading, 4-dir/8-dir animation player, and Unity/TexturePacker exporters.</p>
        <h4>2. JavaScript / Node.js Engine API</h4>
        <pre><code>const doc = PIX2.parse(fileContent);
doc.cells['cell_0_0'].pixels['${m.eyes.leftX},${m.eyes.y[0]}'] = '#00ffff';
const outText = PIX2.serialize(doc);</code></pre>
      `;
    }
  }

function copyAiPrompt() {
    if (!state.doc) return;
    const mode = dom.selectAiPromptMode?.value || 'all-in-one';
    const { version, cellSize, grid } = state.doc.meta;
    const briefs = {
      'full-character': 'Design a consistent full character across the requested facing directions and preserve anchors across the sheet.',
      'walk-animation': 'Create a readable walk cycle with consistent foot contacts and frame timing. Preserve unrelated clips.',
      'accessory-equipment': 'Add the requested accessory in independently editable Regions aligned to each existing pose.',
      'surgical-patch': 'Apply the requested localized frame or color repair. Leave all other cells and hierarchy intact.',
      'raw-spec': 'Use the canonical source and format rules as a reference when validating the requested output.'
    };
    const brief = briefs[mode] || 'Edit or extend the sprite sheet according to the user brief. Keep frame alignment, dimensions and palette continuity.';
    const prompt = Pix2AiPrompt.build({
      brief, source: PIX2.serialize(state.doc), version,
      width: cellSize.w, height: cellSize.h, cols: grid.cols, rows: grid.rows,
      detailed: mode !== 'compact',
      mode
    });
    navigator.clipboard.writeText(prompt).then(() => showToast('Copied PIX2 AI prompt', 'success'))
      .catch(() => showToast('Clipboard unavailable', 'error'));
  }
    return { splitLineComment, highlightPix2Code, renderCodeEditor, lockCodeEditingSilently, handleBeforeLeaveCodeTab, toggleCodeEditMode, copyRawPix2Code, fallbackCopyText, applyCodeToDoc, getSpriteMath, updateAiGuidePane, copyAiPrompt };
  }
  return { create };
})();
