const fs = require('fs');
const pdfjsLib = require('/home/z/my-project/node_modules/pdfjs-dist/build/pdf.mjs');

(async () => {
  const buf = fs.readFileSync('/home/z/my-project/upload/153773805183.PDF');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableWorker: true }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();

  // Collect all items
  const allItems = textContent.items
    .filter(i => i.str && i.str.trim())
    .map(i => ({ str: i.str.trim(), x: i.transform[4], y: Math.round(i.transform[5]) }));

  // Find 'Itens da Fatura' y
  const headerItem = allItems.find(i => /^Itens da Fatura$/i.test(i.str));
  const tableTopY = headerItem ? headerItem.y : 0;
  console.log('tableTopY:', tableTopY);

  // Show all items from tableTopY down to tableTopY - 80
  const tableItems = allItems
    .filter(i => i.y <= tableTopY + 5 && i.y >= tableTopY - 100)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  let lastY = -999;
  for (const item of tableItems) {
    if (item.y !== lastY) {
      console.log('\n--- Y=' + item.y + ' ---');
      lastY = item.y;
    }
    console.log('  x=' + item.x.toFixed(1).padStart(7) + '  str="' + item.str + '"');
  }

  pdf.destroy();
})().catch(e => console.error(e.message));
