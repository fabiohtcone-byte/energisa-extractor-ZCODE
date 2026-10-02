const http = require('http');
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || 'upload/1069.PDF';
const fileData = fs.readFileSync(file);

// Send as application/pdf binary body (much simpler than multipart)
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/extract-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Length': fileData.length,
    'X-Filename': path.basename(file),
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data.substring(0, 500));
  });
});
req.on('error', (e) => console.log('Error:', e.message));
req.write(fileData);
req.end();
