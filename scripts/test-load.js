const path = require('path');
const mod = require('node:module');
const nodeRequire = mod.createRequire('/fake/path');
const loadTable = new Function('req', 'cwd', 'return req(cwd + "/dist/energisa-table-extractor.cjs")');
try {
  const tableModule = loadTable(nodeRequire, process.cwd());
  console.log('LOADED FROM:', process.cwd() + '/dist/energisa-table-extractor.cjs');
  console.log('Has extractTableFromPDF:', typeof tableModule.extractTableFromPDF);
} catch(e) {
  console.log('ERROR:', e.message);
}
