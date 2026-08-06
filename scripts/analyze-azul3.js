const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4167605165.PDF');
  const data = await pdf(buf);
  const lines = data.text.split('\n');
  
  // Find CONSUMO FATURADO and surrounding lines
  console.log('=== Lines 140-180 ===');
  for (let i = 140; i < 180; i++) {
    console.log(`[${i}] ${JSON.stringify(lines[i])}`);
  }
  
  // Also show the full text (it's not that long)
  console.log('\n=== FULL TEXT ===');
  console.log(data.text);
}

main().catch(console.error);