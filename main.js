const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { AgsDatabase } = require('./database');

const DATA_DIR = path.join(app.getPath('userData'), 'AGS-Data');
const SEED_FILE = path.join(__dirname, 'seed-data.json');

let db = null;
let cacheJson = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function bootDb() {
  ensureDataDir();
  db = new AgsDatabase(DATA_DIR);
  const info = db.open(SEED_FILE);
  cacheJson = db.loadRawJson();
  console.log('AGS DB ready:', info.source, '→', info.path);
  console.log('AGS DB stats:', db.stats());
  return info;
}

function getJson() {
  if (!db) bootDb();
  if (cacheJson == null) cacheJson = db.loadRawJson();
  return cacheJson;
}

function saveJson(str) {
  if (!db) bootDb();
  const ok = db.saveRawJson(str);
  if (ok) cacheJson = String(str ?? '');
  return ok;
}

// ---------- IPC (same contract as before + DB extras) ----------
ipcMain.on('ags-load-sync', (e) => {
  e.returnValue = getJson();
});
ipcMain.handle('ags-load', () => getJson());
ipcMain.on('ags-save', (_e, str) => {
  try { saveJson(str); } catch (err) { console.error('ags-save', err); }
});
ipcMain.on('ags-path-sync', (e) => {
  e.returnValue = db ? db.dbPath : path.join(DATA_DIR, 'ags.db');
});
ipcMain.handle('ags-path', () => (db ? db.dbPath : path.join(DATA_DIR, 'ags.db')));
ipcMain.handle('ags-open-folder', async () => {
  ensureDataDir();
  await shell.openPath(DATA_DIR);
});
ipcMain.handle('ags-db-stats', () => {
  if (!db) bootDb();
  return db.stats();
});
ipcMain.handle('ags-db-backup', () => {
  if (!db) bootDb();
  return db.backup();
});
ipcMain.handle('ags-db-force-save', () => {
  if (!db) bootDb();
  db.forceSave();
  return true;
});
ipcMain.handle('ags-open-external', async (_e, url) => {
  if (typeof url === 'string' && (url.startsWith('mailto:') || url.startsWith('https:') || url.startsWith('http:'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AGS Trade Pricing — Desktop v1.4.8',
    backgroundColor: '#07090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'app.html'));
}

app.whenReady().then(() => {
  bootDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  try { if (db) db.forceSave(); } catch (e) {}
});

app.on('window-all-closed', () => {
  try { if (db) db.forceSave(); } catch (e) {}
  if (process.platform !== 'darwin') app.quit();
});
