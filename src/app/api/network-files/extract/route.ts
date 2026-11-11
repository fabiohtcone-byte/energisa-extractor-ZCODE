import { NextRequest, NextResponse } from 'next/server';
import { ShareError, readPdf } from '@/lib/network-share';
import { ExtractionError, extractInvoiceFromBuffer } from '@/lib/pdf-extraction';

export const dynamic = 'force-dynamic';

// POST { month: "202609", folder: "Elektro", file: "123.pdf" } → extracted invoice data.
// One authorized file per request, so the client controls progress and selection.
export async function POST(request: NextRequest) {
  try {
    const { month, folder, file } = await request.json();
    if (typeof month !== 'string' || typeof folder !== 'string' || typeof file !== 'string') {
      return NextResponse.json({ error: 'Informe month, folder e file.' }, { status: 400 });
    }
    const buffer = await readPdf(month, folder, file);
    const { data, stats } = await extractInvoiceFromBuffer(buffer);
    return NextResponse.json({ success: true, fileName: file, data, stats });
  } catch (e) {
    if (e instanceof ShareError || e instanceof ExtractionError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('network-files/extract:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
