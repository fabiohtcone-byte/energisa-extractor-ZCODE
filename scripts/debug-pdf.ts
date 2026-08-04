const fs = require('fs');
const pdfParse = require('pdf-parse');

async function main() {
  const files = fs.readdirSync('/home/z/my-project/upload').filter(f => f.endsWith('.PDF') || f.endsWith('.pdf'));
  
  for (const file of files.slice(0, 3)) {
    const buf = fs.readFileSync('/home/z/my-project/upload/' + file);
    const data = await pdfParse(buf);
    console.log('===== ' + file + ' (' + data.numpages + ' paginas) =====');
    console.log(data.text.substring(0, 4000));
    console.log('\n--- FIM DO TRECHO ---\n\n');
  }
}

main().catch(console.error);
