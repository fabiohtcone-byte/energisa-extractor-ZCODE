const fs = require('fs');
const pdfParse = require('pdf-parse');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/144378605167.PDF');
  const data = await pdfParse(buf);
  const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== Check ENERGISA ===');
  for (let i = 0; i < 10; i++) console.log(i + ': [' + lines[i].substring(0, 60) + ']');
  
  console.log('\n=== Lines 100-135 ===');
  for (let i = 100; i < 135; i++) console.log(i + ': ' + lines[i]);
  
  console.log('\n=== Lines 40-56 ===');
  for (let i = 40; i < 56; i++) console.log(i + ': ' + lines[i]);
}
main().catch(console.error);