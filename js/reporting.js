/**
 * AGS reporting helpers (CSV / summary stats)
 * Loaded before inline app script; attaches to window.AgsReport
 */
(function (global) {
  'use strict';

  function csvCell(v) {
    return '"' + String(v ?? '').replaceAll('"', '""') + '"';
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    const u = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' }));
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 500);
  }

  function moneyNum(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  /** Full quotes export with status, notes, item detail */
  function exportQuotesCsv(quotes) {
    const rows = [[
      'Quote', 'Date', 'Status', 'Customer', 'Phone', 'Email',
      'Products', 'Items', 'Total GBP', 'Notes'
    ]];
    (quotes || []).forEach(q => {
      const buyer = q.buyer || {};
      const items = q.items || [];
      const productText = items.map(i =>
        `${i.product || ''} ${i.design || ''} ${i.width || ''}x${i.height || ''} x${i.qty || 1}`
      ).join(' | ');
      rows.push([
        q.id || '',
        q.date ? new Date(q.date).toISOString().slice(0, 10) : '',
        q.status || 'Draft',
        q.customer || buyer.name || '',
        buyer.phone || '',
        buyer.email || '',
        productText,
        items.length,
        moneyNum(q.total),
        q.notes || ''
      ]);
    });
    const body = rows.map(r => r.map(csvCell).join(',')).join('\n');
    download('ags-quotes-' + new Date().toISOString().slice(0, 10) + '.csv', body);
  }

  /** Customers export */
  function exportCustomersCsv(customers, quotes) {
    const qCount = {};
    (quotes || []).forEach(q => {
      const n = (q.customer || '').toLowerCase();
      if (!n) return;
      qCount[n] = (qCount[n] || 0) + 1;
    });
    const rows = [['Name', 'Type', 'Phone', 'Email', 'Address', 'Postcode', 'City', 'Quotes']];
    (customers || []).forEach(c => {
      rows.push([
        c.name || '', c.type || '', c.phone || '', c.email || '',
        c.address || '', c.postcode || '', c.city || '',
        qCount[(c.name || '').toLowerCase()] || 0
      ]);
    });
    download('ags-customers-' + new Date().toISOString().slice(0, 10) + '.csv',
      rows.map(r => r.map(csvCell).join(',')).join('\n'));
  }

  /** Monthly pipeline summary for last N months */
  function monthlySummary(quotes, months) {
    months = months || 6;
    const now = new Date();
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets.push({
        key,
        label: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
        count: 0,
        total: 0,
        accepted: 0,
        acceptedTotal: 0
      });
    }
    const map = Object.fromEntries(buckets.map(b => [b.key, b]));
    (quotes || []).forEach(q => {
      if (!q.date) return;
      const d = new Date(q.date);
      if (isNaN(d.getTime())) return;
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const b = map[key];
      if (!b) return;
      const st = String(q.status || '');
      if (st === 'Cancelled') return;
      b.count++;
      b.total += Number(q.total) || 0;
      if (st === 'Accepted' || st === 'Invoiced') {
        b.accepted++;
        b.acceptedTotal += Number(q.total) || 0;
      }
    });
    return buckets;
  }

  global.AgsReport = {
    csvCell,
    download,
    exportQuotesCsv,
    exportCustomersCsv,
    monthlySummary
  };
})(typeof window !== 'undefined' ? window : globalThis);
