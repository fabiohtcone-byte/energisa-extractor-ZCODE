// Test multiple PDF extractions
const http = require('http');
const fs = require('fs');
const path = require('path');

const pdfDir = '/home/z/my-project/upload';
const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.PDF') || f.endsWith('.pdf')).slice(0, 5);
console.log('Testing', pdfFiles.length, 'PDFs:', pdfFiles);

let completed = 0;
let crashed = false;

for (const pdfName of pdfFiles) {
  const pdfBuffer = fs.readFileSync(path.join(pdfDir, pdfName));
  const boundary = '----B' + Date.now() + Math.random().toString(36).slice(2);
  const header = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="file"; filename="' + pdfName + '"\r\n' +
    'Content-Type: application/pdf\r\n\r\n'
  );
  const footer = Buffer.from('\r\n--' + boundary + '--\r\n');
  const body = Buffer.concat([header, pdfBuffer, footer]);

  const req = http.request({
    hostname: 'localhost', port: 3000,
    path: '/api/extract-pdf', method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': body.length,
    },
    timeout: 30000,
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      completed++;
      try {
        const j = JSON.parse(data);
        if (j.success) {
          console.log(`✓ ${pdfName}: UC=${j.data.UC}, Cidade=${j.data.Cidade}, Fields=${j.stats.extractedCount}/${j.stats.totalFields}`);
        } else {
          console.log(`✗ ${pdfName}: ${j.error}`);
        }
      } catch(e) {
        console.log(`✗ ${pdfName}: parse error`);
      }
      if (completed === pdfFiles.length) {
        console.log('\nAll tests complete!');
      }
    });
  });
  req.on('error', e => {
    completed++;
    console.log(`✗ ${pdfName}: ${e.message || 'connection error'}`);
    if (completed === pdfFiles.length) console.log('\nAll tests complete!');
  });
  req.on('timeout', () => {
    completed++;
    console.log(`✗ ${pdfName}: timeout`);
    req.destroy();
    if (completed === pdfFiles.length) console.log('\nAll tests complete!');
  });
  req.write(body);
  req.end();
  
  // Small delay between requests (server has 2s interval)
  setTimeout(() => {}, 2500);
}
