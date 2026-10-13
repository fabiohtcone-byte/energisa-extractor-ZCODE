const fs = require('fs');
const pdfParse = require('pdf-parse');
const { extractEnergisaData } = require('/home/z/my-project/dist/energisa-extractor.cjs');

async function main() {
  const pdfs = fs.readdirSync('/home/z/my-project/upload').filter(f => /\.pdf$/i.test(f)).slice(0, 20);
  for (const f of pdfs) {
    try {
      const buf = fs.readFileSync('/home/z/my-project/upload/' + f);
      const pd = await pdfParse(buf);
      const ext = extractEnergisaData(pd.text, null);
      console.log(f.padEnd(25), '→', 'UC:', (ext.UC || '?').padEnd(15), 'MesRef:', (ext.MesReferencia || '?').padEnd(20), 'Valor:', ext.ValorTotal || '?');
    } catch(e) {
      console.log(f.padEnd(25), '→ ERRO:', e.message.substring(0, 50));
    }
  }
}
main();
