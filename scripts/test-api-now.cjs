const http = require('http');
const fs = require('fs');

const pdfPath = '/home/z/my-project/upload/33836.PDF';
const pdfBuffer = fs.readFileSync(pdfPath);
console.log('PDF size:', pdfBuffer.length, 'bytes');

const boundary = '----TestBoundary' + Date.now();
const header = Buffer.from(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="33836.PDF"\r\n` +
  `Content-Type: application/pdf\r\n\r\n`
);
const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
const body = Buffer.concat([header, pdfBuffer, footer]);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/extract-pdf',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
  timeout: 30000,
};

const req = http.request(options, (res) => {
  let data = '';
  console.log('Status:', res.statusCode);
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Success:', parsed.success);
      console.log('Stats:', JSON.stringify(parsed.stats, null, 2));
      if (parsed.data) {
        const d = parsed.data;
        console.log('UC:', d.UC);
        console.log('Cidade:', d.Cidade);
        console.log('MesReferencia:', d.MesReferencia);
        console.log('ValorTotal:', d.ValorTotal);
      }
      if (parsed.error) console.log('Error:', parsed.error);
    } catch(e) {
      console.log('Raw response (first 500):', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.on('timeout', () => { console.error('Request timed out'); req.destroy(); });
req.write(body);
req.end();
