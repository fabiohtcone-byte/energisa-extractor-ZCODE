// Direct extraction test - bypass server
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';
const pdfPath = path.join(ROOT, 'upload/33836.PDF');
const buffer = fs.readFileSync(pdfPath);
console.log('PDF size:', buffer.length, 'bytes');

// Test pdf-parse
console.log('\n--- Testing pdf-parse ---');
const pdfParse = require('pdf-parse');
pdfParse(buffer).then(pd => {
  console.log('Pages:', pd.numpages);
  console.log('Text length:', pd.text.length);
  console.log('First 200 chars:', pd.text.substring(0, 200));

  // Test extractEnergisaData
  console.log('\n--- Testing extractEnergisaData ---');
  const { extractEnergisaData } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));
  const result = extractEnergisaData(pd.text, null);
  console.log('UC:', result.UC);
  console.log('Cidade:', result.Cidade);
  console.log('ValorTotal:', result.ValorTotal);
  console.log('Fields extracted:', Object.values(result).filter(v => v !== '').length);
  
  // Test table extraction (child process)
  console.log('\n--- Testing table extraction ---');
  const { execFile } = require('child_process');
  const tmpFile = path.join(ROOT, 'tmp_test_extract.pdf');
  fs.writeFileSync(tmpFile, buffer);
  
  execFile('node', [path.join(ROOT, 'scripts/extract-table.cjs'), tmpFile], {
    timeout: 14000,
    maxBuffer: 10 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    try { fs.unlinkSync(tmpFile); } catch(e) {}
    if (err) {
      console.log('Table extraction error:', err.message?.substring(0, 200));
      if (stderr) console.log('Stderr:', stderr.substring(0, 200));
    }
    if (stdout) {
      try {
        const td = JSON.parse(stdout);
        console.log('Table items:', td.items?.length || 0);
        if (td.error) console.log('Table error:', td.error);
      } catch(e) {
        console.log('Table parse error:', e.message);
        console.log('Stdout first 200:', stdout.substring(0, 200));
      }
    }
    console.log('\n--- All tests complete ---');
  });
}).catch(err => {
  console.error('pdf-parse error:', err.message);
  console.error(err.stack?.substring(0, 500));
});
