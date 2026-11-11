const EditorFileSave = (() => {
  function createQueue() {
    let pending = Promise.resolve();
    return task => {
      const result = pending.then(task, task);
      pending = result.catch(() => {});
      return result;
    };
  }

  async function permission(handle, interactive = true) {
    if (!handle.queryPermission) return true;
    if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
    return interactive && handle.requestPermission
      ? await handle.requestPermission({ mode: 'readwrite' }) === 'granted'
      : false;
  }

  async function write(handle, text) {
    const stream = await handle.createWritable();
    try {
      await stream.write(text);
      await stream.close();
    } catch (error) {
      try { await stream.abort?.(); } catch (_) {}
      throw error;
    }
    try {
      return (await handle.getFile()).lastModified;
    } catch (_) {
      return 0;
    }
  }

  return { createQueue, permission, write };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = EditorFileSave;
