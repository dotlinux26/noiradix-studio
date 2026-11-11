/** Shared palette library storage and dropdown controller. App owns color selection. */
const EditorPaletteLibrary = (() => {
  'use strict';
  const storageKey = 'noiradix_custom_palettes';

  function create({ storage, getSelect, builtIns, fallback = null, actionLabel, ownerDocument }) {
    function load() {
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (_) { return {}; }
    }

    function save(palettes) {
      try { storage.setItem(storageKey, JSON.stringify(palettes)); }
      catch (error) { console.warn('Failed to save custom palettes to storage:', error); }
    }

    function populate() {
      const select = getSelect();
      if (!select) return;
      const document = ownerDocument || select.ownerDocument;
      const previous = select.value;
      select.innerHTML = '';
      const group = (label) => {
        const element = document.createElement('optgroup');
        element.label = label;
        select.appendChild(element);
        return element;
      };
      const option = (parent, value, text) => {
        const element = document.createElement('option');
        element.value = value;
        element.textContent = text;
        parent.appendChild(element);
      };
      const presets = group('Built-in Presets');
      for (const preset of builtIns) option(presets, preset.id, `${preset.name} (${preset.count})`);
      const custom = load();
      const keys = Object.keys(custom);
      if (keys.length) {
        const library = group('Custom Library');
        for (const key of keys) {
          const item = custom[key];
          option(library, `custom_${key}`, `${item.name} (${item.colors ? item.colors.length : 0})`);
        }
      }
      option(group('Actions'), '__new_preset__', actionLabel);
      // Compare values directly; persisted names never become a selector.
      if (Array.from(select.options).some(item => item.value === previous)) select.value = previous;
      else if (fallback !== null) select.value = fallback;
    }
    return { load, save, populate };
  }
  return { create };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = EditorPaletteLibrary;
