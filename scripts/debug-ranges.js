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

  allItems.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let currentRow = [], currentRowY = -999;
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

  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const avgY = row.reduce((s, r) => s + r.y, 0) / row.length;
    if (avgY > tableTopY + 10) continue;
    if (avgY < tableTopY - 50) break;
    const texts = row.map(r => r.str);
    if (texts.some(t => /^Quant/i.test(t)) && texts.some(t => /^Unid/i.test(t))) {
      headerRowIndex = i; break;
    }
  }

  const nearbyStart = Math.max(0, headerRowIndex - 5);
  const nearbyEnd = Math.min(rows.length, headerRowIndex + 5);
  const nearbyItems = rows.slice(nearbyStart, nearbyEnd).flat();
  const headerRow = rows[headerRowIndex];

  const quantH = headerRow.find(r => /^Quant/i.test(r.str));
  const unidH = headerRow.find(r => /^Unid/i.test(r.str));
  const precoH = headerRow.find(r => /Pre[cç]o/i.test(r.str)) || nearbyItems.find(r => /Pre[cç]o/i.test(r.str));
  const valorH_full = nearbyItems.find(r => /^Valor\s*\(R\$\)/i.test(r.str));
  const valorH_bare = headerRow.find(r => /^Valor\s*\(R\$\)/i.test(r.str));
  const valorH_bare_safe = !valorH_full ? nearbyItems.find(r => /^Valor$/i.test(r.str) && r.x < 420) : null;
  const valorH = valorH_full || valorH_bare || valorH_bare_safe;
  const pisH = nearbyItems.find(r => /PIS\s*\/\s*COFINS/i.test(r.str)) || nearbyItems.find(r => /^COFINS\s*\(R\$\)/i.test(r.str));
  const icmsBaseH = nearbyItems.find(r => /^ICMS\s*\(R\$\)/i.test(r.str) && r.x < 420);
  const icmsPctH = nearbyItems.find(r => /^ICMS$/i.test(r.str) && r.x > (icmsBaseH?.x ?? 300) && r.x < 420);
  const tarifaH = nearbyItems.find(r => /(?:^Tarifa|unit\s*R\$)/i.test(r.str) && r.x < 420);
  const icmsValorH = nearbyItems.find(r => /^\(R\$\)$/i.test(r.str) && r.x > (icmsPctH?.x ?? icmsBaseH?.x ?? 340) && r.x < (tarifaH?.x ?? 420));

  console.log('Headers:');
  console.log('  quantH:', quantH?.x, quantH?.str);
  console.log('  precoH:', precoH?.x, precoH?.str);
  console.log('  valorH:', valorH?.x, valorH?.str);
  console.log('  pisH:', pisH?.x, pisH?.str);
  console.log('  icmsBaseH:', icmsBaseH?.x, icmsBaseH?.str);
  console.log('  icmsPctH:', icmsPctH?.x, icmsPctH?.str);
  console.log('  icmsValorH:', icmsValorH?.x, icmsValorH?.str);
  console.log('  tarifaH:', tarifaH?.x, tarifaH?.str);

  // Reproduce the column range calculation
  const colXs = [
    quantH?.x ?? 180, precoH?.x ?? 205, valorH?.x ?? 250, pisH?.x ?? 280,
    icmsBaseH?.x ?? 315, icmsPctH?.x ?? 340, icmsValorH?.x ?? 365, tarifaH?.x ?? 400,
  ].sort((a, b) => a - b);
  console.log('\ncolXs (sorted):', colXs);

  const midpoints = [0];
  for (let i = 0; i < colXs.length - 1; i++) midpoints.push((colXs[i] + colXs[i + 1]) / 2);
  midpoints.push(999);
  console.log('midpoints:', midpoints);

  const getRange = (headerX, fallbackIdx) => {
    if (!headerX) return { min: 0, max: 999 };
    const idx = colXs.indexOf(headerX);
    console.log(`  getRange(${headerX.toFixed(1)}, ${fallbackIdx}) -> idx=${idx}, range=[${midpoints[idx]}, ${midpoints[idx + 1]})`);
    return { min: midpoints[idx], max: midpoints[idx + 1] };
  };

  console.log('\nColumn ranges:');
  console.log('  quantidade:', getRange(quantH?.x, 1));
  console.log('  precoUnit:', getRange(precoH?.x, 1));
  console.log('  valor:', getRange(valorH?.x, 2));
  console.log('  pisCofins:', getRange(pisH?.x, 3));
  console.log('  baseCalc:', getRange(icmsBaseH?.x, 4));
  console.log('  aliquota:', getRange(icmsPctH?.x, 5));
  console.log('  icms:', getRange(icmsValorH?.x, 6));
  console.log('  tarifa:', getRange(tarifaH?.x, 7));

  // Check data values against ranges
  console.log('\n=== Data check for Consumo Ponta ===');
  const pontaData = [
    { x: 184.9, str: '21.575,48' },
    { x: 218.9, str: '0,888420' },
    { x: 253.9, str: '19.168,36' },
    { x: 283.0, str: '1.471,65' },
    { x: 315.1, str: '19.168,36' },
    { x: 342.5, str: '17' },
    { x: 364.2, str: '3.258,62' },
    { x: 399.2, str: '0,669190' },
  ];

  pdf.destroy();
})().catch(e => console.error(e.message));
