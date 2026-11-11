import { NextRequest, NextResponse } from 'next/server';
import { FATURAS_BASE_PATH, ShareError, listFolders, listMonths, listPdfs } from '@/lib/network-share';

export const dynamic = 'force-dynamic';

// GET /api/network-files                         → months (AAAAMM)
// GET /api/network-files?month=202609            → folders of the month with PDF counts
// GET /api/network-files?month=202609&folder=X   → PDFs inside the folder
export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get('month');
    const folder = request.nextUrl.searchParams.get('folder');
    if (!month) return NextResponse.json({ base: FATURAS_BASE_PATH, months: await listMonths() });
    if (!folder) return NextResponse.json({ month, folders: await listFolders(month) });
    return NextResponse.json({ month, folder, files: await listPdfs(month, folder) });
  } catch (e) {
    if (e instanceof ShareError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('network-files:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
