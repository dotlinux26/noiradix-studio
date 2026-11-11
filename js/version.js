/**
 * NOIRADIX Product & Format Version Manifest
 * Single authoritative source of truth for version metadata across NOIRADIX Studio & PixelArt.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NOIRADIX_VERSION = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    documentTitle(app, fileName, unsaved = false) {
      const appTitle = `${app.name} ${app.displayVersion}`;
      return fileName ? `${unsaved ? '● ' : ''}${fileName} — ${appTitle}` : appTitle;
    },
    studio: {
      name: 'NOIRADIX Studio',
      version: '2.1.2-beta.1',
      channel: 'Beta',
      displayVersion: 'v2.1.2-beta.1'
    },
    pixelart: {
      name: 'NOIRADIX PixelArt',
      version: '2.1.2-beta.1',
      channel: 'Beta',
      displayVersion: 'v2.1.2-beta.1'
    },
    format: {
      name: 'PIX2',
      version: '1.1',
      displayVersion: 'PIX2 v1.1'
    },
    releaseDate: '2026-11-11',
    author: 'Nguyen Duc Canh (dotlinux26)',
    copyright: '© 2026 dotlinux26 (Nguyen Duc Canh). All rights reserved.',
    canonicalDomain: 'https://noiradix.me'
  };
});

