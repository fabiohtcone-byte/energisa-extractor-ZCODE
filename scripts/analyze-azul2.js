const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4167605165.PDF');
  const data = await pdf(buf);
  const lines = data.text.split('\n');
  
  // Show lines 50-80 (around the Itens da Fatura table)
  console.log('=== Lines 50-80 ===');
  for (let i = 50; i < 80; i++) {
    console.log(`[${i}] ${JSON.stringify(lines[i])}`);
  }
  
  console.log('\n=== Lines 115-140 (around consumption chart) ===');
  for (let i = 115; i < 140; i++) {
    console.log(`[${i}] ${JSON.stringify(lines[i])}`);
  }
  
  console.log('\n=== Lines 200-230 ===');
  for (let i = 200; i < 230; i++) {
    console.log(`[${i}] ${JSON.stringify(lines[i])}`);
  }
}

main().catch(console.error);