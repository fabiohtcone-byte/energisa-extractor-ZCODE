const fs = require('fs');
const pdfjsLib = require('/home/z/my-project/node_modules/pdfjs-dist/build/pdf.mjs');

(async () => {
  const buf = fs.readFileSync('/home/z/my-project/upload/153773805183.PDF');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableWorker: true }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();

  const allItems = textContent.items
    .filter(i => i.str && i.str.trim())
    .map(i => ({ str: i.str.trim(), x: i.transform[4], y: Math.round(i.transform[5]) }));

  const headerItem = allItems.find(i => /^Itens da Fatura$/i.test(i.str));
  const tableTopY = headerItem.y;

  // Group into rows with ±1 tolerance
  allItems.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let currentRow = [];
  let currentRowY = -999;
  for (const item of allItems) {
    if (Math.abs(item.y - currentRowY) <= 1) {
      currentRow.push(item);
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [item];
      currentRowY = item.y;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const avgY = row.reduce((s, r) => s + r.y, 0) / row.length;
    if (avgY > tableTopY + 10) continue;
    if (avgY < tableTopY - 50) break;
    const texts = row.map(r => r.str);
    if (texts.some(t => /^Quant/i.test(t)) && texts.some(t => /^Unid/i.test(t))) {
      headerRowIndex = i;
      console.log('Header row index:', i, 'avgY:', avgY);
      break;
    }
  }

  // Show nearby rows
  console.log('\n=== Nearby rows ===');
  const start = Math.max(0, headerRowIndex - 5);
  const end = Math.min(rows.length, headerRowIndex + 5);
  for (let i = start; i < end; i++) {
    const row = rows[i];
    const ys = [...new Set(row.map(r => r.y))].join(',');
    const strs = row.map(r => `x=${r.x.toFixed(1)}:"${r.str}"`).join(' | ');
    console.log(`Row ${i} [Y=${ys}]: ${strs}`);
  }

  // Check what valorH finds
  const nearbyItems = rows.slice(start, end).flat();
  const valorFull = nearbyItems.find(r => /^Valor\s*\(R\$\)/i.test(r.str));
  const valorBare = nearbyItems.find(r => /^Valor$/i.test(r.str));
  const pisMatch = nearbyItems.find(r => /PIS\s*\/\s*COFINS/i.test(r.str) || /^COFINS\s*\(R\$\)/i.test(r.str));
  const icmsBase = nearbyItems.find(r => /^ICMS\s*\(R\$\)/i.test(r.str));
  const icmsBare = nearbyItems.find(r => /^ICMS$/i.test(r.str));
  const parenR = nearbyItems.find(r => /^\(R\$\)$/i.test(r.str));
  const tarifMatch = nearbyItems.find(r => /(?:^Tarifa|unit\s*R\$)/i.test(r.str));

  console.log('\n=== Header matches ===');
  console.log('valorH_full:', valorFull ? `x=${valorFull.x} str="${valorFull.str}"` : 'NOT FOUND');
  console.log('valorH_bare:', valorBare ? `x=${valorBare.x} str="${valorBare.str}"` : 'NOT FOUND');
  console.log('pisH:', pisMatch ? `x=${pisMatch.x} str="${pisMatch.str}"` : 'NOT FOUND');
  console.log('icmsBaseH:', icmsBase ? `x=${icmsBase.x} str="${icmsBase.str}"` : 'NOT FOUND');
  console.log('icmsBare:', icmsBare ? `x=${icmsBare.x} str="${icmsBare.str}"` : 'NOT FOUND');
  console.log('parenR:', parenR ? `x=${parenR.x} str="${parenR.str}"` : 'NOT FOUND');
  console.log('tarifH:', tarifMatch ? `x=${tarifMatch.x} str="${tarifMatch.str}"` : 'NOT FOUND');

  pdf.destroy();
})().catch(e => console.error(e.message));
