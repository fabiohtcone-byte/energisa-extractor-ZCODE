const http = require('http');
const fs = require('fs');

const file = process.argv[2] || 'upload/1069.PDF';
const fileData = fs.readFileSync(file);
const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

// Build multipart body
const parts = [];
parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.split('/').pop()}"\r\nContent-Type: application/pdf\r\n\r\n`));
parts.push(fileData);
parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
const body = Buffer.concat(parts);

console.log('Uploading', file, '(', fileData.length, 'bytes) to API...');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/extract-pdf',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const j = JSON.parse(data);
      if (j.success) {
        const d = j.data;
        console.log('Concessionaria:', d.Concessionaria);
        console.log('UC:', d.UC);
        console.log('ConsumoTotal:', d.ConsumoTotal || 'VAZIO');
        console.log('ConsumoPonta:', d.ConsumoPonta || '-');
        console.log('ConsumoForaPonta:', d.ConsumoForaPonta || '-');
        console.log('PIS:', d.PIS || 'VAZIO');
        console.log('COFINS:', d.COFINS || 'VAZIO');
        console.log('ICMS:', d.ICMS || 'VAZIO');
        console.log('Stats:', JSON.stringify(j.stats));
      } else {
        console.log('Error:', j.error || 'unknown');
      }
    } catch(e) {
      console.log('Parse error, raw:', data.substring(0, 300));
    }
  });
});
req.on('error', (e) => {
  console.log('Request error:', e.message);
});
req.write(body);
req.end();
