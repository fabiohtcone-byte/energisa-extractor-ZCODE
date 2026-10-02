// Table extraction worker - runs in a separate process to avoid crashing the main server
// Receives PDF buffer via stdin, sends JSON result via stdout
const { extractTableFromPDF } = require('../dist/energisa-table-extractor.cjs');

process.on('message', async (msg) => {
  try {
    if (msg.type === 'extract' && msg.buffer) {
      const result = await Promise.race([
        extractTableFromPDF(Buffer.from(msg.buffer)),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000))
      ]);
      process.send({ type: 'result', id: msg.id, data: result });
    }
  } catch(e) {
    process.send({ type: 'error', id: msg.id, error: e.message });
  }
});
