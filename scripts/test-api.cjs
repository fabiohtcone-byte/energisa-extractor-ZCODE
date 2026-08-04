const fs = require('fs');
const pdfModule = require('../node_modules/pdf-parse/lib/pdf-parse.js');

async function main() {
  const buf = fs.readFileSync('./upload/144378605167.PDF');
  const pdfData = await pdfModule(buf);
  const text = pdfData.text;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Test UC extraction
  console.log('Total lines:', lines.length);
  console.log('Line 102:', JSON.stringify(lines[102]));
  console.log('Line 102 match:', /^([\d.]+-\d+)$/.test(lines[102]));
  
  // Test NOTA FISCAL
  const nfIdx = lines.findIndex(l => /NOTA\s+FISCAL\s*N/.test(l));
  console.log('nfIdx:', nfIdx);
  if (nfIdx >= 0) console.log('nfLine:', lines[nfIdx]);
  
  // Search UC around NF
  for (let i = Math.max(0, nfIdx-2); i <= Math.min(nfIdx+3, lines.length-1); i++) {
    const m = lines[i].match(/^(\d[\d.]+-\d)$/);
    if (m) { console.log('UC found at line', i, ':', m[1]); break; }
  }
  
  // Test KWH
  const kwhLine = lines.find(l => /^KWH[\d.,]+$/.test(l));
  console.log('KWH line:', kwhLine);
  
  // Test Ponta index
  const pontaIdx = lines.findIndex(l => /Ponta$/.test(l));
  console.log('Ponta end idx:', pontaIdx, ':', lines[pontaIdx]);
}
main().catch(console.error);
