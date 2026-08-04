import fs from 'fs';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = '';

const files = fs.readdirSync('/home/z/my-project/upload').filter(f => f.endsWith('.PDF'));

for (const file of files.slice(0, 3)) {
  const buf = fs.readFileSync('/home/z/my-project/upload/' + file);
  const doc = await getDocument({ data: new Uint8Array(buf) }).promise;
  console.log('===== ' + file + ' (' + doc.numPages + ' paginas) =====');
  
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  console.log(fullText.substring(0, 5000));
  console.log('\n--- FIM ---\n');
}
