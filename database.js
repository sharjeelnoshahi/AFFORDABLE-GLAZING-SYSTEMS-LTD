/**
 * AGS Embedded Database Engine
 * ---------------------------
 * Local relational database (zero native deps).
 * File:  <userData>/AGS-Data/ags.db
 * Legacy: ags-data.json is auto-migrated once.
 *
 * Tables:
 *   settings, customers, quotes, quote_items,
 *   matrix_window, matrix_door, custom_designs, meta
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DB_VERSION = 1;

const SCHEMA = {
  settings: {
    pk: 'key',
    columns: ['key', 'value']
  },
  customers: {
    pk: 'id',
    columns: ['id', 'name', 'type', 'phone', 'email', 'address', 'postcode', 'city', 'created_at']
  },
  quotes: {
    pk: 'id',
    columns: [
      'id', 'date', 'status', 'customer_id', 'customer_name', 'disc_pct',
      'buyer_json', 'company_json', 'total', 'pdf_file_name', 'pdf_saved_at', 'created_at'
    ]
  },
  quote_items: {
    pk: 'id',
    columns: [
      'id', 'quote_id', 'line_no', 'product', 'design', 'design_name', 'design_svg',
      'width', 'height', 'qty', 'base', 'pre', 'disc_pct', 'discount', 'ex', 'vat',
      'total', 'glass', 'colour', 'hardware', 'extras_json'
    ]
  },
  matrix_window: {
    pk: null, // composite design_code + height_mm
    columns: ['design_code', 'height_mm', 'price']
  },
  matrix_door: {
    pk: 'design_code',
    columns: ['design_code', 'price', 'max_w', 'max_h']
  },
  custom_designs: {
    pk: 'id',
    columns: [
      'id', 'product', 'code', 'name', 'svg', 'price',
      'max_w', 'max_h', 'dim_w', 'dim_h', 'shapes_json', 'updated_at'
    ]
  },
  meta: {
    pk: 'key',
    columns: ['key', 'value']
  }
};

function emptyTables() {
  const t = {};
  for (const name of Object.keys(SCHEMA)) t[name] = [];
  return t;
}

function nowIso() {
  return new Date().toISOString();
}

class AgsDatabase {
  /**
   * @param {string} dataDir absolute path to AGS-Data folder
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'ags.db');
    this.legacyPath = path.join(dataDir, 'ags-data.json');
    this.backupDir = path.join(dataDir, 'backups');
    this._tables = emptyTables();
    this._dirty = false;
    this._saveTimer = null;
  }

  ensureDir() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
  }

  /** Boot: open DB or migrate legacy JSON / seed */
  open(seedPath) {
    this.ensureDir();
    let source = 'blank';
    if (fs.existsSync(this.dbPath)) {
      this._loadFile(this.dbPath);
      source = 'ags.db';
    } else if (fs.existsSync(this.legacyPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.legacyPath, 'utf8'));
        this.importAppSnapshot(raw);
        this._flushSync();
        const bak = path.join(this.backupDir, 'migrated-from-json-' + Date.now() + '.json');
        try { fs.copyFileSync(this.legacyPath, bak); } catch (e) {}
        source = 'migrated-json';
      } catch (e) {
        console.error('legacy migrate failed', e);
      }
    } else if (seedPath && fs.existsSync(seedPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        this.importAppSnapshot(raw);
        this._flushSync();
        source = 'seed';
      } catch (e) {
        console.error('seed failed', e);
      }
    } else {
      this._tables = emptyTables();
      this._setMeta('db_version', String(DB_VERSION));
      this._setMeta('created_at', nowIso());
      this._flushSync();
      source = 'blank';
    }

    // Always ensure seed/backup designs are permanently present in custom_designs
    if (seedPath && fs.existsSync(seedPath)) {
      try {
        const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        const designs = seed.customDesigns || [];
        if (designs.length) {
          const have = new Set(this._tables.custom_designs.map(d => String(d.product) + ':' + Number(d.code)));
          let nextId = this._tables.custom_designs.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
          let added = 0;
          let refreshed = 0;
          for (const d of designs) {
            const k = String(d.product || 'window') + ':' + Number(d.code);
            if (have.has(k)) {
              // ALWAYS overwrite catalogue designs from seed (no need to delete ags.db)
              const code = Number(d.code) || 0;
              if (code >= 100 && code < 900) {
                const row = this._tables.custom_designs.find(
                  r => String(r.product || 'window') + ':' + Number(r.code) === k
                );
                if (row) {
                  if (d.svg) row.svg = d.svg;
                  if (d.name) row.name = d.name;
                  if (d.shapes) row.shapes_json = JSON.stringify(d.shapes);
                  if (d.price != null) row.price = Number(d.price) || 0;
                  if (d.maxW != null) row.max_w = Number(d.maxW) || row.max_w;
                  if (d.maxH != null) row.max_h = Number(d.maxH) || row.max_h;
                  row.updated_at = nowIso();
                  refreshed++;
                }
              }
              continue;
            }
            this._tables.custom_designs.push({
              id: nextId++,
              product: d.product || 'window',
              code: Number(d.code) || 0,
              name: d.name || '',
              svg: d.svg || '',
              price: Number(d.price) || 0,
              max_w: Number(d.maxW) || 1000,
              max_h: Number(d.maxH) || 2200,
              dim_w: Number(d.dimW) || 1000,
              dim_h: Number(d.dimH) || 2000,
              shapes_json: JSON.stringify(d.shapes || []),
              updated_at: nowIso()
            });
            have.add(k);
            added++;
          }
          if (refreshed > 0 || added > 0) {
            this._dirty = true;
            this._flushSync();
            console.log('AGS seed designs: added', added, 'refreshed', refreshed);
          }
          // Also ensure matrix from seed is present if empty
          if (this._tables.matrix_window.length === 0 && seed.matrix && seed.matrix.window) {
            for (const [code, heights] of Object.entries(seed.matrix.window)) {
              if (!heights || typeof heights !== 'object') continue;
              for (const [h, price] of Object.entries(heights)) {
                if (price == null || price === '') continue;
                this._tables.matrix_window.push({
                  design_code: Number(code),
                  height_mm: Number(h),
                  price: Number(price)
                });
              }
            }
          }
          if (added > 0 || source === 'seed') {
            this._setMeta('designs_seeded', String(this._tables.custom_designs.length));
            this._flushSync();
          }
          console.log('AGS DB designs permanent:', this._tables.custom_designs.length, '(+' + added + ' from seed)');
        }
      } catch (e) {
        console.error('ensure seed designs', e);
      }
    }

    return { source, path: this.dbPath };
  }

  _loadFile(file) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || raw.engine !== 'ags-embedded-db') {
      throw new Error('Not an AGS database file');
    }
    this._tables = emptyTables();
    for (const name of Object.keys(SCHEMA)) {
      this._tables[name] = Array.isArray(raw.tables?.[name]) ? raw.tables[name] : [];
    }
  }

  _setMeta(key, value) {
    const rows = this._tables.meta;
    const i = rows.findIndex(r => r.key === key);
    const row = { key, value: String(value) };
    if (i >= 0) rows[i] = row; else rows.push(row);
  }

  _getMeta(key, def) {
    const r = this._tables.meta.find(x => x.key === key);
    return r ? r.value : def;
  }

  /** Atomic write */
  _flushSync() {
    this.ensureDir();
    this._setMeta('db_version', String(DB_VERSION));
    this._setMeta('updated_at', nowIso());
    const payload = {
      engine: 'ags-embedded-db',
      version: DB_VERSION,
      updated_at: nowIso(),
      tables: this._tables
    };
    const tmp = this.dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 0), 'utf8');
    fs.renameSync(tmp, this.dbPath);
    this._dirty = false;
  }

  /** Debounced save (for rapid UI saves) */
  scheduleSave() {
    this._dirty = true;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try { this._flushSync(); } catch (e) { console.error('db flush', e); }
    }, 80);
  }

  forceSave() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    this._flushSync();
  }

  // ---------- Import / Export app snapshot (compat with app.html) ----------

  /**
   * Convert app.html `db` object → relational tables
   */
  importAppSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return;
    this._tables = emptyTables();
    this._setMeta('db_version', String(DB_VERSION));
    this._setMeta('app_version', String(snap.version || 8));

    // settings
    const s = snap.settings || {};
    for (const [k, v] of Object.entries(s)) {
      this._tables.settings.push({ key: k, value: String(v ?? '') });
    }

    // customers
    for (const c of snap.customers || []) {
      this._tables.customers.push({
        id: Number(c.id) || Date.now(),
        name: c.name || '',
        type: c.type || 'Homeowner',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        postcode: c.postcode || '',
        city: c.city || '',
        created_at: c.created_at || nowIso()
      });
    }

    // quotes + items
    let itemId = 1;
    for (const q of snap.quotes || []) {
      this._tables.quotes.push({
        id: String(q.id),
        date: q.date || nowIso(),
        status: q.status || 'Draft',
        customer_id: q.customerId != null ? Number(q.customerId) : null,
        customer_name: q.customer || q.buyer?.name || '',
        disc_pct: Number(q.discPct) || 0,
        buyer_json: JSON.stringify(q.buyer || {}),
        company_json: JSON.stringify(q.company || {}),
        total: Number(q.total) || 0,
        pdf_file_name: q.pdfFileName || '',
        pdf_saved_at: q.pdfSavedAt || '',
        created_at: q.date || nowIso()
      });
      const items = Array.isArray(q.items) ? q.items : [];
      items.forEach((it, idx) => {
        this._tables.quote_items.push({
          id: itemId++,
          quote_id: String(q.id),
          line_no: idx + 1,
          product: it.product || 'window',
          design: Number(it.design) || 0,
          design_name: it.designName || '',
          design_svg: it.designSvg || '',
          width: Number(it.width) || 0,
          height: Number(it.height) || 0,
          qty: Number(it.qty) || 1,
          base: Number(it.base) || 0,
          pre: Number(it.pre) || 0,
          disc_pct: Number(it.discPct) || 0,
          discount: Number(it.discount) || 0,
          ex: Number(it.ex) || 0,
          vat: Number(it.vat) || 0,
          total: Number(it.total) || 0,
          glass: it.glass || '',
          colour: it.colour || '',
          hardware: it.hardware || '',
          extras_json: JSON.stringify(it.extras || [])
        });
      });
    }

    // matrix window
    const mw = (snap.matrix && snap.matrix.window) || {};
    for (const [code, heights] of Object.entries(mw)) {
      if (!heights || typeof heights !== 'object') continue;
      for (const [h, price] of Object.entries(heights)) {
        if (price == null || price === '') continue;
        this._tables.matrix_window.push({
          design_code: Number(code),
          height_mm: Number(h),
          price: Number(price)
        });
      }
    }

    // matrix door
    const md = (snap.matrix && snap.matrix.door) || {};
    for (const [code, val] of Object.entries(md)) {
      let price = 0, maxW = 1000, maxH = 2200;
      if (val && typeof val === 'object') {
        price = Number(val.fixed != null ? val.fixed : val.price) || 0;
        maxW = Number(val.maxW) || 1000;
        maxH = Number(val.maxH) || 2200;
      } else {
        price = Number(val) || 0;
      }
      this._tables.matrix_door.push({
        design_code: Number(code),
        price,
        max_w: maxW,
        max_h: maxH
      });
    }

    // custom designs
    let cdId = 1;
    for (const d of snap.customDesigns || []) {
      this._tables.custom_designs.push({
        id: cdId++,
        product: d.product || 'window',
        code: Number(d.code) || 0,
        name: d.name || '',
        svg: d.svg || '',
        price: Number(d.price) || 0,
        max_w: Number(d.maxW) || 1000,
        max_h: Number(d.maxH) || 2200,
        dim_w: Number(d.dimW) || 1000,
        dim_h: Number(d.dimH) || 2000,
        shapes_json: JSON.stringify(d.shapes || []),
        updated_at: nowIso()
      });
    }

    this._dirty = true;
  }

  /**
   * Relational tables → app.html `db` snapshot object
   */
  exportAppSnapshot() {
    const settings = {};
    for (const r of this._tables.settings) settings[r.key] = isNaN(Number(r.value)) ? r.value : Number(r.value);
    // keep string company name
    if (settings.company == null) settings.company = 'Affordable Glazing Systems Ltd';
    if (settings.vat == null) settings.vat = 20;
    if (settings.margin == null) settings.margin = 20;

    const customers = this._tables.customers.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      phone: c.phone,
      email: c.email,
      address: c.address,
      postcode: c.postcode,
      city: c.city
    }));

    // group items by quote
    const itemsByQuote = {};
    for (const it of this._tables.quote_items) {
      (itemsByQuote[it.quote_id] || (itemsByQuote[it.quote_id] = [])).push(it);
    }
    for (const k of Object.keys(itemsByQuote)) {
      itemsByQuote[k].sort((a, b) => a.line_no - b.line_no);
    }

    const quotes = this._tables.quotes.map(q => {
      let buyer = {}, company = {};
      try { buyer = JSON.parse(q.buyer_json || '{}'); } catch (e) {}
      try { company = JSON.parse(q.company_json || '{}'); } catch (e) {}
      const items = (itemsByQuote[q.id] || []).map(it => {
        let extras = [];
        try { extras = JSON.parse(it.extras_json || '[]'); } catch (e) {}
        return {
          product: it.product,
          design: it.design,
          designName: it.design_name,
          designSvg: it.design_svg,
          width: it.width,
          height: it.height,
          qty: it.qty,
          base: it.base,
          pre: it.pre,
          discPct: it.disc_pct,
          discount: it.discount,
          ex: it.ex,
          vat: it.vat,
          total: it.total,
          glass: it.glass,
          colour: it.colour,
          hardware: it.hardware,
          extras
        };
      });
      return {
        id: q.id,
        date: q.date,
        status: q.status,
        customer: q.customer_name,
        customerId: q.customer_id,
        discPct: q.disc_pct,
        buyer,
        company,
        total: q.total,
        pdfFileName: q.pdf_file_name || undefined,
        pdfSavedAt: q.pdf_saved_at || undefined,
        items
      };
    });

    const matrix = { window: {}, door: {} };
    for (const r of this._tables.matrix_window) {
      const code = String(r.design_code);
      if (!matrix.window[code]) matrix.window[code] = {};
      matrix.window[code][String(r.height_mm)] = r.price;
    }
    for (const r of this._tables.matrix_door) {
      matrix.door[String(r.design_code)] = { fixed: r.price, maxW: r.max_w, maxH: r.max_h };
    }

    const customDesigns = this._tables.custom_designs.map(d => {
      let shapes = [];
      try { shapes = JSON.parse(d.shapes_json || '[]'); } catch (e) {}
      return {
        product: d.product,
        code: d.code,
        name: d.name,
        svg: d.svg,
        price: d.price,
        maxW: d.max_w,
        maxH: d.max_h,
        dimW: d.dim_w,
        dimH: d.dim_h,
        shapes
      };
    });

    const appVer = Number(this._getMeta('app_version', '8')) || 8;
    return {
      version: appVer,
      settings,
      customers,
      quotes,
      matrix,
      customDesigns
    };
  }

  /** Load as JSON string for app.html */
  loadRawJson() {
    return JSON.stringify(this.exportAppSnapshot());
  }

  /** Save from app.html JSON string */
  saveRawJson(str) {
    try {
      const raw = String(str || '{}');
      if (raw.length > 80 * 1024 * 1024) {
        console.error('saveRawJson: payload too large');
        return false;
      }
      const snap = JSON.parse(raw);
      if (!snap || typeof snap !== 'object') {
        console.error('saveRawJson: invalid snapshot');
        return false;
      }
      if (!Array.isArray(snap.quotes)) snap.quotes = [];
      if (!Array.isArray(snap.customers)) snap.customers = [];
      if (!snap.matrix || typeof snap.matrix !== 'object') snap.matrix = { window: {}, door: {} };
      if (!Array.isArray(snap.customDesigns)) snap.customDesigns = [];
      this.importAppSnapshot(snap);
      this.scheduleSave();
      return true;
    } catch (e) {
      console.error('saveRawJson', e);
      return false;
    }
  }

  // ---------- Direct table helpers (future CRUD UI) ----------

  stats() {
    return {
      path: this.dbPath,
      engine: 'ags-embedded-db',
      version: DB_VERSION,
      customers: this._tables.customers.length,
      quotes: this._tables.quotes.length,
      quote_items: this._tables.quote_items.length,
      matrix_window_rows: this._tables.matrix_window.length,
      matrix_door_rows: this._tables.matrix_door.length,
      custom_designs: this._tables.custom_designs.length,
      updated_at: this._getMeta('updated_at', '')
    };
  }

  /** Manual backup copy */
  backup() {
    this.forceSave();
    const name = 'ags-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.db';
    const dest = path.join(this.backupDir, name);
    fs.copyFileSync(this.dbPath, dest);
    return dest;
  }
}

module.exports = { AgsDatabase, DB_VERSION, SCHEMA };
