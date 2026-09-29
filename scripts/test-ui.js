// Test the UI rendering by using a headless approach
// We'll simulate what the browser does: load the JS chunk and check if FIELD_CATEGORIES includes Grupo B fields

const http = require('http');

// Step 1: Get the main page HTML
function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Check the JS chunk for the FIELD_CATEGORIES definition
  const html = await fetch('http://localhost:3000/');
  
  // Extract all chunk URLs
  const chunkUrls = [];
  const regex = /\/_next\/static\/chunks\/[^"'\s]+\.js/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    chunkUrls.push(match[0]);
  }
  console.log('Found', chunkUrls.length, 'JS chunks');
  
  // Find the chunk that contains FIELD_CATEGORIES
  for (const url of chunkUrls) {
    const chunk = await fetch('http://localhost:3000' + url);
    if (chunk.includes('ConsumoGrupoB_kWh') && chunk.includes('ConsumoGrupoB_Valor')) {
      console.log('✅ Found ConsumoGrupoB fields in chunk:', url);
      
      // Extract the FIELD_CATEGORIES definition
      const catMatch = chunk.match(/category:"Consumo \(kWh\)"[^}]*}/);
      if (catMatch) {
        console.log('  Consumo (kWh) category:', catMatch[0].substring(0, 200));
      }
      
      // Check if the fields array includes ConsumoGrupoB_kWh
      if (chunk.includes('ConsumoGrupoB_kWh') && chunk.includes('ConsumoGrupoB_Valor')) {
        console.log('  ✅ Both ConsumoGrupoB_kWh AND ConsumoGrupoB_Valor are in the chunk');
      }
      
      break;
    }
  }
  
  // Step 2: Upload a PDF and check the API response
  const fs = require('fs');
  const pdfBuffer = fs.readFileSync('/home/z/my-project/upload/91510905101.PDF');
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(header), pdfBuffer, Buffer.from(footer)]);
  
  const apiResult = await new Promise((resolve, reject) => {
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
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  
  console.log('\nAPI Response for 91510905101.PDF:');
  console.log('  Subgrupo:', apiResult.data?.Subgrupo);
  console.log('  ConsumoGrupoB_kWh:', apiResult.data?.ConsumoGrupoB_kWh);
  console.log('  ConsumoGrupoB_Valor:', apiResult.data?.ConsumoGrupoB_Valor);
  console.log('  totalFields:', apiResult.stats?.totalFields);
  
  // List all keys in data that contain "GrupoB"
  const grupoBKeys = Object.keys(apiResult.data || {}).filter(k => k.includes('GrupoB'));
  console.log('  Grupo B keys in data:', grupoBKeys);
}

main().catch(console.error);
