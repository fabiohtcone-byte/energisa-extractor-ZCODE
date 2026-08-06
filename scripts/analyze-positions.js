const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4167605165.PDF');
  const data = await pdf(buf);
  
  // Check if there's position info
  console.log('Has numpages:', data.numpages);
  console.log('Has text:', data.text ? data.text.length : 0);
  
  // Check if pdf-parse itemizer is available
  // pdf-parse has a .getItemIterator() method that gives position info
  if (data.getItemIterator) {
    console.log('Has getItemIterator!');
    const items = data.getItemIterator();
    let count = 0;
    for (const item of items) {
      if (item.str && item.str.trim()) {
        count++;
        if (count <= 200) {
          console.log(`  item[${count}]: "${item.str}" y=${item.transform?.[5]?.toFixed(1)} x=${item.transform?.[4]?.toFixed(1)} w=${item.width?.toFixed(1)} h=${item.height?.toFixed(1)}`);
        }
      }
    }
    console.log('Total items:', count);
  } else {
    console.log('No getItemIterator - trying default approach');
    // Check the raw items
    if (data.items) {
      console.log('Has items array, length:', data.items.length);
      // Show first 50 items with positions
      let c = 0;
      for (const item of data.items) {
        if (item.str && item.str.trim() && c < 200) {
          c++;
          const y = item.transform ? item.transform[5] : '?';
          const x = item.transform ? item.transform[4] : '?';
          console.log(`  [${c}] y=${y.toFixed(1)} x=${x.toFixed(1)}: "${item.str}"`);
        }
      }
      console.log('Total text items:', c);
    }
  }
}

main().catch(e => console.error('Error:', e.message));