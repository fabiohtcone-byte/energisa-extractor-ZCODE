const http = require('http');
const { extractTableFromPDF } = require('./dist/energisa-table-extractor.cjs');

const server = http.createServer(async (req, res) => {
  if (req.url === '/extract' && req.method === 'POST') {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const buf = Buffer.concat(chunks);
      const result = await Promise.race([
        extractTableFromPDF(buf),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
      ]);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({items: [], error: e.message}));
    }
  } else {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end('{"status":"ok"}');
  }
});

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

server.listen(3002, '127.0.0.1', () => {
  console.log('Table extraction service on :3002');
});
