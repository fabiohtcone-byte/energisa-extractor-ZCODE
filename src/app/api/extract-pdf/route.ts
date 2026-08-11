import { NextRequest, NextResponse } from 'next/server';
import { extractEnergisaData, FIELD_LABELS, FIELD_CATEGORIES } from '@/lib/energisa-extractor';

// Dynamic require that bypasses Turbopack static analysis
function dynamicRequire(modulePath: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function('p', 'return require(p)')(modulePath);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text with pdf-parse
    let pdfData: { text: string; numpages: number };
    try {
      const pdfModule = dynamicRequire('pdf-parse') as { default: (b: Buffer) => Promise<{text: string; numpages: number}> };
      pdfData = await (pdfModule.default || pdfModule)(buffer);
    } catch {
      try {
        const pdfModule2 = dynamicRequire('pdf-parse/lib/pdf-parse.js') as (b: Buffer) => Promise<{text: string; numpages: number}>;
        pdfData = await pdfModule2(buffer);
      } catch (e) {
        return NextResponse.json(
          { error: 'Falha ao processar PDF: ' + (e as Error).message },
          { status: 500 }
        );
      }
    }
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto do PDF. O arquivo pode ser escaneado/imagem.' },
        { status: 422 }
      );
    }

    // Try table extraction with pdfjs-dist (position-based)
    let tableData: Array<{label: string; quantidade: string; valor: string; pisCofins: string; icms: string}> | undefined;
    try {
      const tableModule = dynamicRequire(process.cwd() + '/dist/energisa-table-extractor.cjs') as { extractTableFromPDF: (b: Buffer) => Promise<{items: typeof tableData}> };
      const result = await Promise.race([
        tableModule.extractTableFromPDF(buffer),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('table timeout')), 10000))
      ]);
      if (result && result.items && result.items.length > 0) {
        tableData = result.items;
      }
    } catch (e) {
      console.log('Table extraction skipped:', (e as Error).message);
    }

    const extracted = extractEnergisaData(text, tableData);

    const allValues = Object.values(extracted);
    const extractedCount = allValues.filter((v) => v !== '').length;
    const totalFields = allValues.length;
    const extractionRate = Math.round((extractedCount / totalFields) * 100);

    const response: Record<string, unknown> = {
      success: true,
      data: extracted,
      stats: { extractedCount, totalFields, extractionRate, pageCount: pdfData.numpages },
      rawTextLength: text.length,
    };

    response.rawText = text;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar o PDF. Tente novamente.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    fields: FIELD_LABELS,
    categories: FIELD_CATEGORIES,
  });
}
