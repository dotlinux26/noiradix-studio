const assert = require('node:assert/strict');
const PIX2 = require('../js/pix2-format.js');
const StudioFileRecovery = require('../js/studio-file-recovery.js');

function source(title, color = '#ff0000') {
  return `@pix2 1.1\n@meta\n  title: "${title}"\n@grid\n  cols: 1\n  rows: 1\n  default_cell: 16x16\n@cell cell_0_0\n  p 1,1 ${color}\n@end`;
}

function fakeHandle(name, text, modified = 100) {
  return {
    kind: 'file', name,
    async getFile() { return new File([text], name, { lastModified: modified }); }
  };
}

(async () => {
  const savedText = source('Saved');
  const savedDoc = PIX2.parseValidated(savedText);
  const identical = {
    fileName: 'saved.pix2', doc: savedDoc, isDirty: true,
    lastSavedContent: savedText, lastKnownFileModified: 90
  };
  const restored = await StudioFileRecovery.reconnect(identical, fakeHandle('saved.pix2', savedText), PIX2);
  assert.deepEqual(restored, { linked: true, synchronized: true, source: 'same-content' });
  assert.equal(identical.isDirty, false, 'disk-equal saved file must restore clean');
  assert.equal(identical.lastKnownFileModified, 100);

  const externalText = source('Changed outside', '#0000ff');
  const staleClean = {
    fileName: 'saved.pix2', doc: savedDoc, isDirty: false,
    lastSavedContent: savedText, lastKnownFileModified: 90
  };
  const refreshed = await StudioFileRecovery.reconnect(staleClean, fakeHandle('saved.pix2', externalText, 110), PIX2);
  assert.equal(refreshed.source, 'disk-refresh');
  assert.equal(PIX2.serialize(staleClean.doc), PIX2.serialize(PIX2.parseValidated(externalText)),
    'clean workspace must refresh from changed disk source');

  const draftDoc = PIX2.parseValidated(source('Unsaved draft', '#00ff00'));
  const dirtyDraft = {
    fileName: 'saved.pix2', doc: draftDoc, isDirty: true,
    lastSavedContent: savedText, lastKnownFileModified: 90
  };
  const conflict = await StudioFileRecovery.reconnect(dirtyDraft, fakeHandle('saved.pix2', externalText, 110), PIX2);
  assert.equal(conflict.source, 'preserved-draft');
  assert.equal(PIX2.serialize(dirtyDraft.doc), PIX2.serialize(draftDoc), 'dirty browser draft must never be overwritten');
  assert.equal(dirtyDraft.lastSavedContent, savedText, 'prior disk baseline must survive for conflict detection');
  assert.equal(dirtyDraft.lastKnownFileModified, 90, 'prior timestamp must survive so external change is detectable');

  const wrongName = { fileName: 'other.pix2', doc: savedDoc, isDirty: false };
  assert.equal((await StudioFileRecovery.reconnect(wrongName, fakeHandle('saved.pix2', savedText), PIX2)).reason,
    'file-name-mismatch');
  const unreadable = { fileName: 'saved.pix2', doc: savedDoc, isDirty: false };
  const brokenHandle = { kind: 'file', name: 'saved.pix2', async getFile() { throw new Error('permission denied'); } };
  assert.equal((await StudioFileRecovery.reconnect(unreadable, brokenHandle, PIX2)).reason, 'disk-read-failed');
  assert.equal(unreadable.fileHandle, null, 'unverified handle must not be presented as a linked saved file');

  console.log('PASS Studio file recovery reconnects verified disk state and preserves dirty drafts for conflict detection');
})().catch(error => { console.error(error); process.exitCode = 1; });
