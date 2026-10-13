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
      const cidade = ext.Cidade || '❌ VAZIO';
      const endereco = ext.Endereco || '❌ VAZIO';
      console.log(f.padEnd(25), '|', cidade.padEnd(22), '|', endereco);
    } catch(e) {
      console.log(f.padEnd(25), '| ERRO:', e.message.substring(0, 40));
    }
  }
}
main();
