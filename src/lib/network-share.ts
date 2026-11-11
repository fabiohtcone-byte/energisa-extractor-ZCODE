import path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * Network share access (read-only), restricted by an authorization model:
 *  - Only the configured base folder is reachable (FATURAS_BASE_PATH).
 *  - Only month folders named AAAAMM (e.g. 202609) are authorized.
 *  - Only direct sub-folders of a month (e.g. Elektro, Energisa) are authorized.
 *  - Only .pdf files are readable, and only by plain file name (no path separators).
 * Every resolved path is verified to stay inside the base folder.
 */
export const FATURAS_BASE_PATH = process.env.FATURAS_BASE_PATH || '\\\\10.100.100.114\\Sicone_app\\Faturas';
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const MONTH_RE = /^\d{6}$/;

export class ShareError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertPlainName(name: string, label: string) {
  if (!name || name === '.' || name === '..' || /[\\/:*?"<>|\0]/.test(name)) {
    throw new ShareError(`${label} inválido.`);
  }
}

export function assertMonth(month: string) {
  if (!MONTH_RE.test(month)) throw new ShareError('Mês inválido (use AAAAMM).');
}

/** Resolve month/folder/file inside the base path, rejecting anything that escapes it. */
export function resolveSharePath(month: string, folder?: string, file?: string): string {
  assertMonth(month);
  const parts = [month];
  if (folder) { assertPlainName(folder, 'Pasta'); parts.push(folder); }
  if (file) {
    assertPlainName(file, 'Arquivo');
    if (!file.toLowerCase().endsWith('.pdf')) throw new ShareError('Apenas arquivos PDF são autorizados.', 403);
    parts.push(file);
  }
  const base = path.resolve(FATURAS_BASE_PATH);
  const target = path.resolve(base, ...parts);
  if (!(target.toLowerCase() + path.sep).startsWith(base.toLowerCase() + path.sep) || target.toLowerCase() === base.toLowerCase()) {
    throw new ShareError('Caminho não autorizado.', 403);
  }
  return target;
}

export interface MonthEntry { month: string }
export interface FolderEntry { name: string; pdfCount: number }
export interface PdfEntry { name: string; size: number; modified: string }

function mapShareFsError(e: unknown): never {
  if (e instanceof ShareError) throw e;
  const code = (e as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT') throw new ShareError('Pasta ou arquivo não encontrado na rede.', 404);
  if (code === 'EACCES' || code === 'EPERM') throw new ShareError('Sem permissão de acesso à pasta de rede.', 403);
  throw new ShareError('Falha ao acessar a pasta de rede: ' + ((e as Error)?.message ?? 'erro desconhecido'), 502);
}

export async function listMonths(): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.resolve(FATURAS_BASE_PATH), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && MONTH_RE.test(e.name)).map((e) => e.name).sort().reverse();
  } catch (e) { mapShareFsError(e); }
}

/** Sub-folders of a month that directly contain at least one PDF. */
export async function listFolders(month: string): Promise<FolderEntry[]> {
  const dir = resolveSharePath(month);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const out: FolderEntry[] = [];
    await Promise.all(dirs.map(async (d) => {
      try {
        const inner = await fs.readdir(path.join(dir, d.name), { withFileTypes: true });
        const pdfCount = inner.filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.pdf')).length;
        if (pdfCount > 0) out.push({ name: d.name, pdfCount });
      } catch { /* unreadable folder: ignore */ }
    }));
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) { mapShareFsError(e); }
}

export async function listPdfs(month: string, folder: string): Promise<PdfEntry[]> {
  const dir = resolveSharePath(month, folder);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const pdfs = entries.filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.pdf'));
    const out: PdfEntry[] = [];
    for (let i = 0; i < pdfs.length; i += 25) {
      const chunk = pdfs.slice(i, i + 25);
      const stats = await Promise.all(chunk.map((f) => fs.stat(path.join(dir, f.name)).catch(() => null)));
      chunk.forEach((f, idx) => {
        const st = stats[idx];
        if (st) out.push({ name: f.name, size: st.size, modified: st.mtime.toISOString() });
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  } catch (e) { mapShareFsError(e); }
}

export async function readPdf(month: string, folder: string, file: string): Promise<Buffer> {
  const target = resolveSharePath(month, folder, file);
  try {
    const st = await fs.stat(target);
    if (!st.isFile()) throw new ShareError('Arquivo não encontrado.', 404);
    if (st.size > MAX_PDF_BYTES) throw new ShareError('Arquivo excede o limite de 50 MB.', 413);
    return await fs.readFile(target);
  } catch (e) { mapShareFsError(e); }
}
