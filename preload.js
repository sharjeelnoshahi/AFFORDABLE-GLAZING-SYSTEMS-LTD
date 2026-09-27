const { contextBridge, ipcRenderer } = require('electron');

let syncCache = null;

contextBridge.exposeInMainWorld('agsDesktop', {
  loadSync() {
    try {
      const v = ipcRenderer.sendSync('ags-load-sync');
      syncCache = v;
      return v;
    } catch (e) {
      return syncCache;
    }
  },
  async load() {
    const v = await ipcRenderer.invoke('ags-load');
    syncCache = v;
    return v;
  },
  async save(str) {
    syncCache = str;
    ipcRenderer.send('ags-save', str);
    return true;
  },
  path() {
    try {
      return ipcRenderer.sendSync('ags-path-sync');
    } catch (e) {
      return '';
    }
  },
  openFolder() {
    return ipcRenderer.invoke('ags-open-folder');
  },
  /** Database stats: table row counts, path, engine */
  dbStats() {
    return ipcRenderer.invoke('ags-db-stats');
  },
  /** Copy ags.db into backups/ folder, returns backup path */
  dbBackup() {
    return ipcRenderer.invoke('ags-db-backup');
  },
  dbForceSave() {
    return ipcRenderer.invoke('ags-db-force-save');
  },
  openExternal(url) {
    return ipcRenderer.invoke('ags-open-external', url);
  }
});
