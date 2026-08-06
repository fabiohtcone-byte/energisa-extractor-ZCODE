const pdf = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/4167605165.PDF');
  const data = await pdf(buf);
  const lines = data.text.split('\n');
  
  // Find all relevant lines
  const patterns = [
    /Consumo|Demanda|Ultrapassagem|Reactiva|Ponta|Fora.*Ponta|kWh|KW|KWH/i,
    /Itens da Fatura|Item/i,
    /Classificação|Modalidade|Subgrupo/i,
  ];
  
  console.log('=== All lines matching patterns ===');
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      if (p.test(lines[i])) {
        console.log(`[${i}] ${JSON.stringify(lines[i])}`);
        break;
      }
    }
  }
}

main().catch(console.error);
