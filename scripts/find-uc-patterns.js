const fs = require('fs');
const pdfParse = require('pdf-parse');

// Test a few PDFs to find where their UC number appears
const tests = [
  { file: 'upload/144378605167.PDF', expectedUC: '144378605167' },
  { file: 'upload/4167605165.PDF', expectedUC: '4167605165' },
  { file: 'upload/2214205140.PDF', expectedUC: '2214205140' },
  { file: 'upload/565605136.PDF', expectedUC: '565605136' },
];

async function test() {
  for (const t of tests) {
    console.log('=== ' + t.file.split('/').pop() + ' (expected UC: ' + t.expectedUC + ') ===');
    const d = await pdfParse(fs.readFileSync(t.file));
    const lines = d.text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const flat = lines.join(' ');
    
    // Search for the expected UC number in the text
    const uc = t.expectedUC;
    const idx = flat.indexOf(uc);
    if (idx >= 0) {
      // Get context around the match
      const start = Math.max(0, idx - 80);
      const end = Math.min(flat.length, idx + uc.length + 80);
      console.log('  FOUND at index', idx);
      console.log('  Context:', JSON.stringify(flat.substring(start, end)));
    } else {
      // Try with leading zeros
      for (let pad = 1; pad <= 4; pad++) {
        const padded = '0'.repeat(pad) + uc;
        const pidx = flat.indexOf(padded);
        if (pidx >= 0) {
          const start = Math.max(0, pidx - 80);
          const end = Math.min(flat.length, pidx + padded.length + 80);
          console.log('  FOUND (padded ' + pad + ') at index', pidx);
          console.log('  Context:', JSON.stringify(flat.substring(start, end)));
          break;
        }
      }
      if (idx < 0) console.log('  NOT FOUND in text');
    }
    console.log('');
  }
}
test().catch(e => console.error(e));
