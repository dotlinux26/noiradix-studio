const EditorWorkspaceStorage = (() => {
  const database = 'noiradix_browser_workspaces';
  const store = 'workspaces';
  let connection;
  let updatedAt = 0;

  function open() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Workspace database is blocked'));
      }).catch(error => {
        connection = null;
        throw error;
      });
    }
    return connection;
  }

  async function read(key) {
    let local, backup;
    try {
      local = JSON.parse(localStorage.getItem(key));
    } catch (_) {}
    try {
      const db = await open();
      backup = await new Promise((resolve, reject) => {
        const request = db.transaction(store, 'readonly').objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (_) {}
    const newest = (backup?.updatedAt || 0) > (local?.updatedAt || 0) ? backup : local;
    updatedAt = Math.max(updatedAt, Number(newest?.updatedAt) || 0);
    return newest;
  }

  async function write(key, workspace) {
    updatedAt = Math.max(Date.now(), updatedAt + 1);
    const value = { ...workspace, updatedAt };
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      try {
        const db = await open();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onabort = tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        console.warn('Browser workspace save failed:', error);
        return false;
      }
    }
  }

  return { read, write };
})();
