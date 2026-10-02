// Simpler test - binary upload with X-Filename header
const http = require('http');
const fs = require('fs');

const pdfPath = '/home/z/my-project/upload/33836.PDF';
const pdfBuffer = fs.readFileSync(pdfPath);
console.log('PDF size:', pdfBuffer.length, 'bytes');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/extract-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/pdf',
    'X-Filename': '33836.PDF',
    'Content-Length': pdfBuffer.length,
  },
  timeout: 30000,
};

console.log('Sending request...');
const req = http.request(options, (res) => {
  let data = '';
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
    try {
      const parsed = JSON.parse(data);
      console.log('Success:', parsed.success);
      if (parsed.stats) console.log('Stats:', JSON.stringify(parsed.stats, null, 2));
      if (parsed.data) {
        const d = parsed.data;
        console.log('UC:', d.UC);
        console.log('Cidade:', d.Cidade);
        console.log('ValorTotal:', d.ValorTotal);
      }
      if (parsed.error) console.log('Error:', parsed.error);
    } catch(e) {
      console.log('Raw response (first 1000):', data.substring(0, 1000));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.on('timeout', () => { console.error('Request timed out'); req.destroy(); });
req.write(pdfBuffer);
req.end();
