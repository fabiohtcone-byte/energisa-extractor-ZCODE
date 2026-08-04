const fs = require('fs');
const pdfParse = require('pdf-parse');
async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/144378605167.PDF');
  const data = await pdfParse(buf);
  // Show text with visible newlines
  const lines = data.text.split('\n');
  lines.forEach((line, i) => {
    if (line.trim()) console.log(i + ': |' + line + '|');
  });
}
main().catch(console.error);
