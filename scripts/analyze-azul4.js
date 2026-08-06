const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4167605165.PDF');
  const data = await pdf(buf);
  const lines = data.text.split('\n');
  
  // Find all lines with numbers > 1000 (potential consumption/demanda values)
  console.log('=== Lines with large numbers (>1000) ===');
  for (let i = 0; i < lines.length; i++) {
    const nums = lines[i].match(/(\d[\d.]+,\d{2})/g);
    if (nums) {
      for (const n of nums) {
        const val = parseFloat(n.replace('.', '').replace(',', '.'));
        if (val >= 1000) {
          console.log(`[${i}] val=${val} in: ${JSON.stringify(lines[i])}`);
        }
      }
    }
  }
  
  // Show the Itens da Fatura area in detail (lines 20-100)
  console.log('\n=== Itens da Fatura section (lines 20-100) ===');
  for (let i = 20; i < 100; i++) {
    console.log(`[${i}] ${JSON.stringify(lines[i])}`);
  }
}

main().catch(console.error);