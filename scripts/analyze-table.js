const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');

async function main() {
  const buf = new Uint8Array(fs.readFileSync('/home/z/my-project/upload/4167605165.PDF'));
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group items by Y position (same row)
    const rows = {};
    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const key = `${y}`;
      if (!rows[key]) rows[key] = [];
      rows[key].push({ str: item.str.trim(), x, y, w: item.width });
    }
    
    // Sort rows by Y (top to bottom), items within row by X (left to right)
    const sortedYs = Object.keys(rows).map(Number).sort((a, b) => b - a);
    
    // Find rows with Itens da Fatura table data
    console.log(`=== Page ${pageNum} - All text rows ===`);
    for (const y of sortedYs) {
      const items = rows[y].sort((a, b) => a.x - b.x);
      const text = items.map(i => i.str).join(' | ');
      // Show all rows that have numbers or key labels
      if (/\d/.test(text) || /Itens|Consumo|Demanda|Ponta|Fora|ICMS|PIS|COFINS|Base|Tarifa|Valor|Quant|Unid/i.test(text)) {
        console.log(`y=${y}: ${JSON.stringify(items.map(i => ({s:i.str, x:Math.round(i.x)})))}`);
      }
    }
  }
}

main().catch(e => console.error('Error:', e.message));
