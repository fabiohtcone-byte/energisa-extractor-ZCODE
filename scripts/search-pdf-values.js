const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4321005168.PDF');
  const data = await pdf(buf);
  const text = data.text;
  
  // Search for 17,34 and 185,35 anywhere
  console.log('=== Searching for 17,34 ===');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/17,34/.test(lines[i])) {
      console.log(`[${i}] ${JSON.stringify(lines[i])}`);
      // Show context
      for (let j = Math.max(0,i-3); j <= Math.min(lines.length-1, i+3); j++) {
        console.log(`  [${j}] ${JSON.stringify(lines[j])}`);
      }
    }
  }
  console.log('\n=== Searching for 185,35 ===');
  for (let i = 0; i < lines.length; i++) {
    if (/185,35/.test(lines[i])) {
      console.log(`[${i}] ${JSON.stringify(lines[i])}`);
      for (let j = Math.max(0,i-3); j <= Math.min(lines.length-1, i+3); j++) {
        console.log(`  [${j}] ${JSON.stringify(lines[j])}`);
      }
    }
  }
  
  // Also search for any R$ values near GDI section
  console.log('\n=== Full PDF text ===');
  console.log(text);
}

main().catch(console.error);
