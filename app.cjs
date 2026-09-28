const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';
const BUILD = path.join(ROOT, '.next');
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2',
  '.json':'application/json; charset=utf-8',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
function sendFile(res, fp, cache) {
  try {
    const d = fs.readFileSync(fp);
    const h = { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' };
    if (cache) h['Cache-Control'] = 'public, max-age=31536000, immutable';
    res.writeHead(200, h); res.end(d);
  } catch { res.writeHead(404); res.end('Not found'); }
}

// Pre-cache static files to avoid readFileSync blocking under load
const staticCache = new Map();
function cacheStaticFile(fp) {
  if (staticCache.has(fp)) return staticCache.get(fp);
  try {
    const d = fs.readFileSync(fp);
    const entry = { data: d, type: MIME[path.extname(fp)] || 'application/octet-stream' };
    staticCache.set(fp, entry);
    return entry;
  } catch { return null; }
}
function sendCachedFile(res, fp) {
  const entry = cacheStaticFile(fp);
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': entry.type, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.end(entry.data);
}
function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((ok, fail) => {
    const c = []; req.on('data', chunk => c.push(chunk));
    req.on('end', () => ok(Buffer.concat(c))); req.on('error', fail);
  });
}
function parseMultipart(buf, boundary) {
  const parts = [], delim = Buffer.from('--' + boundary);
  let s = buf.indexOf(delim); if (s === -1) return parts; s += delim.length;
  while (true) {
    if (buf[s] === 0x0d && buf[s+1] === 0x0a) s += 2;
    const he = buf.indexOf(Buffer.from('\r\n\r\n'), s); if (he === -1) break;
    const hs = buf.slice(s, he).toString(); const bs = he + 4, nb = buf.indexOf(delim, bs); if (nb === -1) break;
    parts.push({ name: (hs.match(/name="([^"]+)"/) || [])[1] || null, filename: (hs.match(/filename="([^"]+)"/) || [])[1] || null, body: buf.slice(bs, nb - 2) });
    s = nb + delim.length; if (buf[s] === 0x2d && buf[s+1] === 0x2d) break;
  }
  return parts;
}

// Pre-load modules once (avoid clearing require.cache which can cause crashes)
const pdfParse = require('pdf-parse');
const { extractEnergisaData } = require('./dist/energisa-extractor.cjs');
let tableExtractor = null;
try { tableExtractor = require('./dist/energisa-table-extractor.cjs'); } catch(e) {}

// Pre-warm static file cache with index.html and common assets
cacheStaticFile(path.join(BUILD, 'server', 'app', 'index.html'));
try {
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (/\.(js|css|woff2?|ico|svg|png)$/.test(entry.name)) cacheStaticFile(full);
    }
  };
  walkDir(path.join(BUILD, 'static'));
} catch(e) {}
console.log('Static cache entries:', staticCache.size);

// Keep-alive: track last request time
let lastReq = Date.now();

const srv = http.createServer(async (req, res) => {
  lastReq = Date.now();
  try {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/api/health') return json(res, { status: 'ok', uptime: process.uptime() });
    if (p === '/api/extract-pdf' && req.method === 'POST') {
      const body = await readBody(req);
      const bm = (req.headers['content-type'] || '').match(/boundary=([\w\-]+)/);
      if (!bm) return json(res, { error: 'invalid' }, 400);
      const parts = parseMultipart(body, bm[1]);
      const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
      if (!fp) return json(res, { error: 'no file' }, 400);
      const pd = await pdfParse(fp.body);
      let td = null;
      try { if (tableExtractor) td = await Promise.race([tableExtractor.extractTableFromPDF(fp.body), new Promise((_,r) => setTimeout(() => r(new Error('t')), 10000))]); } catch(e) {}
      if (!pd.text || !pd.text.trim()) return json(res, { error: 'Sem texto' }, 422);
      const ext = extractEnergisaData(pd.text, td);
      const vals = Object.values(ext), cnt = vals.filter(v => v !== '').length;
      return json(res, { success: true, data: ext, stats: { extractedCount: cnt, totalFields: vals.length, extractionRate: Math.round(cnt/vals.length*100), pageCount: pd.numpages, tableItems: td?.items?.length ?? 0 } });
    }
    if (p === '/api/export-excel' && req.method === 'POST') {
      const body = await readBody(req); let parsed;
      try { parsed = JSON.parse(body.toString()); } catch { return json(res, {error:'bad json'}, 400); }
      const { invoices } = parsed; if (!invoices || !Array.isArray(invoices) || !invoices.length) return json(res, {error:'empty'}, 400);
      const XLSX = require('xlsx');
      // Column order exactly as requested: [headerLabel, dataKey or null for manual]
      const cols = [
        ['UC',                          'UC'],
        ['Gerência',                    null],
        ['LOCINS',                      null],
        ['Cidade',                      'Cidade'],
        ['Tipo',                        'Tipo'],
        ['Mercado',                     'Mercado'],
        ['Concessionária',              'Concessionaria'],
        ['Mês Referência',              'MesReferencia'],
        ['Ano Leitura',                 'AnoLeitura'],
        ['Vencimento',                  'Vencimento'],
        ['Nota Fiscal',                 'NotaFiscal'],
        ['Modalidade Tarifária',        'ModalidadeTarifaria'],
        ['Subgrupo',                    'Subgrupo'],
        ['Valor Total (R$)',            'ValorTotal'],
        ['Demanda Contratada Ponta (kW)',           'DemandaContratadaPonta'],
        ['Demanda Contratada Fora Ponta (kW)',       'DemandaContratadaForaPonta'],
        ['Demanda Todos os Períodos (kW)',           null],
        ['Demanda Medida Ponta (kW)',                'DemandaMedidaPonta'],
        ['Valor Demanda Medida Ponta (R$)',          'ValorDemandaPonta'],
        ['Demanda Medida Fora Ponta (kW)',           'DemandaMedidaForaPonta'],
        ['Valor Demanda Medida Fora Ponta (R$)',     'ValorDemandaForaPonta'],
        ['Consumo Ponta (kWh)',                      'ConsumoPonta'],
        ['Consumo Fora Ponta (kWh)',                 'ConsumoForaPonta'],
        ['Consumo Total (kWh)',                      'ConsumoTotal'],
        ['Consumo em kWh (Grupo B)',                 'ConsumoGrupoB_kWh'],
        ['Valor Consumo Ponta (R$)',                 'ValorConsumoPonta'],
        ['Valor Consumo Fora Ponta (R$)',            'ValorConsumoForaPonta'],
        ['Consumo (R$) (Grupo B)',                   'ConsumoGrupoB_Valor'],
        ['Demanda Não Consumida Ponta (kW)',         'DemandaNaoConsumidaPonta'],
        ['Valor Demanda Não Consumida Ponta (R$)',   'ValorNaoConsumidaPonta'],
        ['Demanda Não Consumida Fora Ponta (kW)',    'DemandaNaoConsumidaForaPonta'],
        ['Valor Demanda Não Consumida Fora Ponta (R$)','ValorNaoConsumidaForaPonta'],
        ['Ultrapassagem Ponta (kW)',                  'UltrapassagemPonta'],
        ['Valor Ultrapassagem Ponta (R$)',            'ValorUltrapassagemPonta'],
        ['Ultrapassagem Fora Ponta (kW)',             'UltrapassagemForaPonta'],
        ['Valor Ultrapassagem Fora Ponta (R$)',       'ValorUltrapassagemForaPonta'],
        ['Reativa Excedente Ponta (kVArh)',           'ReativaExcedentePonta'],
        ['Valor Reativa Excedente Ponta (R$)',        'ValorReativaExcedentePonta'],
        ['Reativa Excedente Fora Ponta (kVArh)',      'ReativaExcedenteForaPonta'],
        ['Valor Reativa Excedente Fora Ponta (R$)',   'ValorReativaExcedenteForaPonta'],
        ['GDI oUC (kWh)',                             'EnergiaAtvInjetadaGDIoUC_Qtd'],
        ['Valor GDI oUC (R$)',                        'EnergiaAtvInjetadaGDIoUC_Valor'],
        ['GDI mUC (kWh)',                             'EnergiaAtvInjetadaGDImUC_Qtd'],
        ['Valor GDI mUC (R$)',                        'EnergiaAtvInjetadaGDImUC_Valor'],
        ['Saldo Acumulado GD (kWh)',                   'SaldoAcumuladoGD'],
        ['Energia Injetada (kWh)',                    null],
        ['Energia Compensada (kWh)',                  null],
        ['CIP (R$)',                                  'CIP'],
        ['Outros Encargos (R$)',                      null],
        ['PIS (R$)',                                  'PIS'],
        ['COFINS (R$)',                               'COFINS'],
        ['ICMS (R$)',                                 'ICMS'],
      ];
      const hdrs = cols.map(c => c[0]);
      const keys = cols.map(c => c[1]);
      const rows = invoices.map(inv => keys.map(k => k === null ? '' : (inv[k] || '')));
      const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]);
      ws['!cols'] = cols.map(c => {
        const l = c[0];
        if (l.includes('UC') && !l.includes('GDI')) return { wch: 22 };
        if (l.includes('Gerência') || l.includes('LOCINS')) return { wch: 18 };
        return { wch: 28 };
      });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.writeHead(200, { 'Content-Type': MIME['.xlsx'], 'Content-Disposition': 'attachment; filename="faturas_energisa.xlsx"' }); res.end(buf); return;
    }
    if (p.startsWith('/_next/')) return sendCachedFile(res, path.join(BUILD, p.replace('/_next', '')));
    if (p === '/' || p === '/index.html') return sendCachedFile(res, path.join(BUILD, 'server', 'app', 'index.html'));
    res.writeHead(404); res.end('404');
  } catch (e) { if (!res.headersSent) json(res, { error: e.message }, 500); }
});

// Ignore SIGTERM/SIGHUP to stay alive in container
try { process.on('SIGTERM', () => console.log('Ignored SIGTERM')); } catch(e) {}
try { process.on('SIGHUP', () => console.log('Ignored SIGHUP')); } catch(e) {}

srv.listen(3000, '0.0.0.0', () => console.log('> Ready on :3000'));

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('uncaught:', err.message);
  // Don't exit on signal registration errors in container
  if (err.message && err.message.includes('uv_signal_start')) return;
});
process.on('unhandledRejection', (err) => { console.error('unhandled:', err?.message || err); });