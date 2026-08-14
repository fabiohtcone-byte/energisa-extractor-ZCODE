const path = require('path');
const ROOT = '/home/z/my-project';

let buf = Buffer.alloc(0);
process.stdin.on('data', c => buf = Buffer.concat([buf, c]));
process.stdin.on('end', () => {
  try {
    const parsed = JSON.parse(buf.toString());
    const { invoices } = parsed;
    if (!invoices || !Array.isArray(invoices) || !invoices.length) {
      process.stderr.write('empty'); process.exit(1);
    }
    const XLSX = require('xlsx');
    const { FIELD_LABELS } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));
    const fk = Object.keys(FIELD_LABELS);
    const hdrs = [...fk.map(k => FIELD_LABELS[k]), 'Gerência', 'LOCINS'];
    const rows = invoices.map(inv => [...fk.map(k => inv[k] || ''), '', '']);
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]);
    ws['!cols'] = hdrs.map(() => ({ wch: 28 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    process.stdout.write(out);
  } catch (e) {
    process.stderr.write(e.message); process.exit(1);
  }
});
