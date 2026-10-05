const http = require('http');
const fs = require('fs');
const path = require('path');

const filePath = '/home/z/my-project/upload/356205159.PDF';
const fileBuffer = fs.readFileSync(filePath);
const fileName = path.basename(filePath);
const boundary = '----TestBoundary' + Date.now();

// Build multipart body
const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`;
const footer = `\r\n--${boundary}--\r\n`;
const body = Buffer.concat([
  Buffer.from(header),
  fileBuffer,
  Buffer.from(footer)
]);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/extract-pdf',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
};

console.log('Request body size:', body.length);
console.log('Boundary:', boundary);
console.log('Content-Type:', options.headers['Content-Type']);

const req = http.request(options, (res) => {
  let data = '';
  console.log('Response status:', res.statusCode);
  console.log('Response headers:', JSON.stringify(res.headers));
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response body:', data.substring(0, 2000));
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(body);
req.end();
