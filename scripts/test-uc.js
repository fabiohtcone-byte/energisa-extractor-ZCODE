const fs = require('fs');
const pdfParse = require('pdf-parse');

const files = [
  'upload/144378605167.PDF',
  'upload/153773805183.PDF',
  'upload/2214205140.PDF',
  'upload/2305505194.PDF',
  'upload/4167605165.PDF',
  'upload/4456305122.PDF',
  'upload/565605136.PDF',
  'upload/724705186.PDF',
  'upload/7929105158.PDF',
  'upload/7948705165.PDF',
  'upload/8092005187.PDF',
  'upload/356205159.PDF',
  'upload/4321005168.PDF',
];

async function test() {
  for (const f of files) {
    if (!fs.existsSync(f)) { console.log('=== ' + f + ' === NOT FOUND'); continue; }
    console.log('=== ' + f.split('/').pop() + ' ===');
    const d = await pdfParse(fs.readFileSync(f));
    const lines = d.text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const flat = lines.join(' ');

    // Strategy 1: slash format on own line
    let found = false;
    for (const line of lines) {
      const m = line.match(/^(?:\d{1,3}\/)?(\d{4,8})-\d$/);
      if (m) {
        const num = m[1].replace(/^0+/, '') || '0';
        if (num.length >= 3) { console.log('  S1 slash:', num, 'from:', JSON.stringify(line)); found = true; break; }
      }
    }
    if (!found) console.log('  S1 slash: no match');

    // Strategy 2: slash format in line (excluding CNPJ context)
    const slashMatches = flat.match(/(\d{1,3})\/(\d{4,8})-\d/g);
    if (slashMatches) {
      for (const sm of slashMatches) {
        const m = sm.match(/(\d{1,3})\/(\d{4,8})-\d/);
        const num = m[2].replace(/^0+/, '') || '0';
        if (num.length >= 3 && parseInt(m[2]) >= 1000) {
          console.log('  S2 in-line:', num, 'from:', sm);
        }
      }
    }

    // MATRICULA
    const mat = flat.match(/MATR[IÍ]CULA[\s:]{0,5}0*(\d{4,10})(?:-\d{4}-\d{2}-\d)?/i);
    console.log('  MATRICULA:', mat ? mat[1] : 'none');

    // Old S3 (digits+letter)
    for (const line of lines) {
      const m = line.match(/^(\d{7,13})(?=[A-Za-zÀ-ÿ])/);
      if (m && !/^(\d{4})[-\/]/.test(line) && !/CEP|CNPJ|CPF|Insc/i.test(line)) {
        console.log('  OLD_S3:', m[1], 'from:', JSON.stringify(line.substring(0, 40)));
        break;
      }
    }

    // Standalone 7-13 digit lines
    const standalone = lines.filter(l => /^\d{7,13}$/.test(l));
    if (standalone.length > 0) console.log('  Standalone nums:', standalone);

    console.log('');
  }
}
test().catch(e => console.error(e));
