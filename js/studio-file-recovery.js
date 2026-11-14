/** Reconcile a restored Studio draft with its previously linked disk file. */
const StudioFileRecovery = (() => {
  async function reconnect(session, handle, PIX2) {
    if (!session || !session.doc || !handle || handle.kind !== 'file') {
      return { linked: false, reason: 'missing-session-or-file-handle' };
    }
    if (session.fileName && handle.name !== session.fileName) {
      return { linked: false, reason: 'file-name-mismatch' };
    }

    try {
      const file = await handle.getFile();
      const diskText = await file.text();
      const diskDoc = PIX2.parseValidated(diskText);
      const diskContent = PIX2.serialize(diskDoc);
      const draftContent = PIX2.serialize(session.doc);
      const previousBaseline = session.lastSavedContent;
      const previousModified = session.lastKnownFileModified || 0;
      session.fileHandle = handle;
      session.filePath = session.filePath || handle.name;

      if (diskContent === draftContent) {
        session.lastSavedContent = diskText;
        session.lastKnownFileModified = file.lastModified || 0;
        session.isDirty = false;
        return { linked: true, synchronized: true, source: 'same-content' };
      }
      if (!session.isDirty) {
        session.doc = diskDoc;
        session.lastSavedContent = diskText;
        session.lastKnownFileModified = file.lastModified || 0;
        session.isDirty = false;
        return { linked: true, synchronized: true, source: 'disk-refresh' };
      }
      // Preserve the previously saved baseline so the watcher can tell whether
      // the on-disk file changed while this newer browser draft was unsaved.
      if (typeof previousBaseline !== 'string' || !previousBaseline.trim()) {
        session.lastSavedContent = diskText;
        session.lastKnownFileModified = file.lastModified || 0;
      } else {
        session.lastSavedContent = previousBaseline;
        session.lastKnownFileModified = previousModified;
      }
      return { linked: true, synchronized: false, source: 'preserved-draft' };
    } catch (error) {
      session.fileHandle = null;
      return { linked: false, reason: 'disk-read-failed', error };
    }
  }

  return { reconnect };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = StudioFileRecovery;
