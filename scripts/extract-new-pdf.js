const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4321005168.PDF');
  const data = await pdf(buf);
  const lines = data.text.split('\n');
  
  // Find GDI lines and surrounding context
  let firstGDI = -1;
  let nOUC = 0, nMUC = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/Energia\s*Atv\s*Injetada\s*GDI\s*oUC/i.test(lines[i])) {
      nOUC++; if (firstGDI < 0) firstGDI = i;
    } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*mUC/i.test(lines[i])) {
      nMUC++; if (firstGDI < 0) firstGDI = i;
    }
  }
  console.log('nOUC:', nOUC, 'nMUC:', nMUC, 'firstGDI:', firstGDI);
  
  // Print ALL lines from firstGDI to firstGDI+120
  console.log('\n=== Lines from GDI section ===');
  for (let i = firstGDI; i < Math.min(firstGDI + 120, lines.length); i++) {
    const line = lines[i];
    const isChave = /^chave de acesso:\s*$/i.test(line);
    const isNegNum = /^(-\d[\d.]*,\d{2})$/.test(line);
    const isPosNum = /^(\d[\d.]*,\d{2})$/.test(line);
    const isGDI = /GDI/i.test(line);
    const isImportante = /Importante/i.test(line);
    console.log(`[${i}] ${JSON.stringify(line)}` + 
      (isChave ? ' <<< CHAVE' : '') + 
      (isNegNum ? ' <<< NEG' : '') + 
      (isPosNum ? ' <<< POS_NUM' : '') + 
      (isGDI && !/chave/i.test(line) ? ' <<< GDI' : ''));
  }
}

main().catch(console.error);
