const fs = require('fs');
const pdfParse = require('pdf-parse');

async function main() {
  for (const f of ['7948705165.PDF', '356205159.PDF', '144378605167.PDF', '153773805183.PDF']) {
    const buf = fs.readFileSync('/home/z/my-project/upload/' + f);
    const pd = await pdfParse(buf);
    const lines = pd.text.split('\n');
    console.log('=== ' + f + ' ===');
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      if (/^(RUA|AV|AVE|LOT|R |R\d)/i.test(lines[i])) {
        console.log('  line ' + i + ':', JSON.stringify(lines[i]));
        if (i+1 < lines.length) console.log('  next:', JSON.stringify(lines[i+1].substring(0,80)));
      }
    }
  }
}
main();
