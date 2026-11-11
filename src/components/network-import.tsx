'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Calendar,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { EnergisaInvoiceData } from '@/lib/energisa-fields';

export interface NetworkExtractionResult {
  fileName: string;
  /** Origin of the file, formatted as "<Pasta>_<AAAAMM>" (e.g. Energisa_202609). */
  source: string;
  data: EnergisaInvoiceData;
  stats: { extractedCount: number; totalFields: number; extractionRate: number; pageCount: number };
}

interface FolderEntry { name: string; pdfCount: number }
interface PdfEntry { name: string; size: number; modified: string }
type Status = 'pending' | 'processing' | 'done' | 'error';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const fmtSize = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

const fmtMonthLabel = (m: string) => {
  const y = m.slice(0, 4);
  const mm = parseInt(m.slice(4), 10);
  const name = MONTH_NAMES[mm - 1] || m.slice(4);
  return `${name}/${y}`;
};

const fmtMonthShort = (m: string) => `${m.slice(4)}/${m.slice(0, 4)}`;

// Keys for identifying files and folders across multiple months
const fileKey = (m: string, f: string, name: string) => `${m}\u0000${f}\u0000${name}`;
const mfKey = (m: string, f: string) => `${m}\u0000${f}`;

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro');
  return json;
}

export function NetworkImport({ onDone }: { onDone: (results: NetworkExtractionResult[]) => void }) {
  const [base, setBase] = useState('');
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthSearch, setMonthSearch] = useState('');

  // Folders per month cache
  const [foldersByMonth, setFoldersByMonth] = useState<Record<string, FolderEntry[]>>({});
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());

  // Selected folder names (e.g. ['Elektro', 'Energisa'])
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

  // Files per month+folder cache (key: `${month}\u0000${folder}`)
  const [filesByMF, setFilesByMF] = useState<Record<string, PdfEntry[]>>({});
  const [loadingFilesMF, setLoadingFilesMF] = useState<Set<string>>(new Set());

  // Collapsed state for groups in Step 3
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Set of authorized fileKeys: `${month}\u0000${folder}\u0000${name}`
  const [authorized, setAuthorized] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loadingBase, setLoadingBase] = useState(false);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});

  // Load all available months on mount
  const loadMonths = useCallback(async () => {
    setLoadingBase(true);
    setError('');
    try {
      const j = await getJson('/api/network-files');
      if (j) {
        setBase(j.base);
        setMonths(j.months ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingBase(false);
    }
  }, []);

  useEffect(() => { loadMonths(); }, [loadMonths]);

  // Load folders for a given month
  const loadFoldersForMonth = useCallback(async (m: string) => {
    if (foldersByMonth[m]) return foldersByMonth[m];
    setLoadingMonths((s) => new Set(s).add(m));
    try {
      const res = await getJson(`/api/network-files?month=${m}`);
      const list: FolderEntry[] = res?.folders ?? [];
      setFoldersByMonth((prev) => ({ ...prev, [m]: list }));
      return list;
    } catch (e) {
      console.error(`Erro ao carregar pastas de ${m}:`, e);
      return [];
    } finally {
      setLoadingMonths((s) => {
        const next = new Set(s);
        next.delete(m);
        return next;
      });
    }
  }, [foldersByMonth]);

  // Whenever selectedMonths changes, ensure folders are loaded for all selected months
  useEffect(() => {
    selectedMonths.forEach((m) => {
      if (!foldersByMonth[m] && !loadingMonths.has(m)) {
        loadFoldersForMonth(m);
      }
    });
  }, [selectedMonths, foldersByMonth, loadingMonths, loadFoldersForMonth]);

  // Load files for a specific month + folder pair
  const loadFilesForMF = useCallback(async (m: string, f: string) => {
    const k = mfKey(m, f);
    if (filesByMF[k]) return filesByMF[k];
    setLoadingFilesMF((s) => new Set(s).add(k));
    try {
      const res = await getJson(`/api/network-files?month=${m}&folder=${encodeURIComponent(f)}`);
      const list: PdfEntry[] = res?.files ?? [];
      setFilesByMF((prev) => ({ ...prev, [k]: list }));
      return list;
    } catch (e) {
      console.error(`Erro ao carregar arquivos de ${m}/${f}:`, e);
      return [];
    } finally {
      setLoadingFilesMF((s) => {
        const next = new Set(s);
        next.delete(k);
        return next;
      });
    }
  }, [filesByMF]);

  // Whenever selectedMonths or selectedFolders change, load files for matching combinations
  useEffect(() => {
    for (const m of selectedMonths) {
      const mFolders = foldersByMonth[m] ?? [];
      for (const f of selectedFolders) {
        if (mFolders.some((x) => x.name === f)) {
          const k = mfKey(m, f);
          if (!filesByMF[k] && !loadingFilesMF.has(k)) {
            loadFilesForMF(m, f);
          }
        }
      }
    }
  }, [selectedMonths, selectedFolders, foldersByMonth, filesByMF, loadingFilesMF, loadFilesForMF]);

  // Month selection helpers
  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort().reverse()
    );
  };

  const selectQuickMonths = (list: string[]) => {
    setSelectedMonths([...list].sort().reverse());
  };

  // Unique folders available across currently selected months
  const availableFolders = useMemo(() => {
    const map = new Map<string, { count: number; totalPdfs: number; months: string[] }>();
    for (const m of selectedMonths) {
      const list = foldersByMonth[m] ?? [];
      for (const f of list) {
        const cur = map.get(f.name) ?? { count: 0, totalPdfs: 0, months: [] };
        cur.count += 1;
        cur.totalPdfs += f.pdfCount;
        cur.months.push(m);
        map.set(f.name, cur);
      }
    }
    return Array.from(map.entries())
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.totalPdfs - a.totalPdfs);
  }, [selectedMonths, foldersByMonth]);

  const toggleFolder = (f: string) => {
    setSelectedFolders((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  // Active groups in Step 3 (month + folder combinations)
  const activeGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: {
      month: string;
      folder: string;
      key: string;
      allFiles: PdfEntry[];
      visibleFiles: PdfEntry[];
    }[] = [];

    for (const m of selectedMonths) {
      const mFolders = foldersByMonth[m] ?? [];
      for (const f of selectedFolders) {
        if (mFolders.some((x) => x.name === f)) {
          const k = mfKey(m, f);
          const all = filesByMF[k] ?? [];
          const visible = q ? all.filter((x) => x.name.toLowerCase().includes(q)) : all;
          groups.push({
            month: m,
            folder: f,
            key: k,
            allFiles: all,
            visibleFiles: visible,
          });
        }
      }
    }
    return groups;
  }, [selectedMonths, selectedFolders, foldersByMonth, filesByMF, search]);

  // Total files currently available across active groups
  const totalAvailableFiles = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + g.allFiles.length, 0);
  }, [activeGroups]);

  // Queue of authorized files ready to extract
  const queue = useMemo(() => {
    const qItems: { month: string; folder: string; name: string; key: string }[] = [];
    for (const g of activeGroups) {
      for (const file of g.allFiles) {
        const k = fileKey(g.month, g.folder, file.name);
        if (authorized.has(k)) {
          qItems.push({ month: g.month, folder: g.folder, name: file.name, key: k });
        }
      }
    }
    return qItems;
  }, [activeGroups, authorized]);

  // Toggle authorization for a single file
  const toggleFile = (m: string, f: string, name: string) => {
    const k = fileKey(m, f, name);
    setAuthorized((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Check if all visible files in a group are authorized
  const isGroupAllAuthorized = (g: typeof activeGroups[0]) => {
    if (g.visibleFiles.length === 0) return false;
    return g.visibleFiles.every((file) => authorized.has(fileKey(g.month, g.folder, file.name)));
  };

  // Toggle authorization for all visible files in a group
  const toggleGroupFiles = (g: typeof activeGroups[0]) => {
    const allAuth = isGroupAllAuthorized(g);
    setAuthorized((prev) => {
      const next = new Set(prev);
      g.visibleFiles.forEach((file) => {
        const k = fileKey(g.month, g.folder, file.name);
        if (allAuth) next.delete(k);
        else next.add(k);
      });
      return next;
    });
  };

  // Toggle authorization for all visible files across all active groups
  const allVisibleFilesCount = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + g.visibleFiles.length, 0);
  }, [activeGroups]);

  const allVisibleAuthorized = useMemo(() => {
    if (allVisibleFilesCount === 0) return false;
    return activeGroups.every((g) =>
      g.visibleFiles.every((file) => authorized.has(fileKey(g.month, g.folder, file.name)))
    );
  }, [activeGroups, allVisibleFilesCount, authorized]);

  const toggleAllVisible = () => {
    setAuthorized((prev) => {
      const next = new Set(prev);
      activeGroups.forEach((g) => {
        g.visibleFiles.forEach((file) => {
          const k = fileKey(g.month, g.folder, file.name);
          if (allVisibleAuthorized) next.delete(k);
          else next.add(k);
        });
      });
      return next;
    });
  };

  const toggleCollapse = (k: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Execute extraction on all authorized items
  const run = async () => {
    if (!queue.length) {
      toast.error('Autorize ao menos um arquivo.');
      return;
    }
    setRunning(true);
    setStatus(Object.fromEntries(queue.map((i) => [i.key, 'pending' as Status])));
    const results: NetworkExtractionResult[] = [];

    for (const item of queue) {
      setStatus((s) => ({ ...s, [item.key]: 'processing' }));
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 60000);
        let res: Response;
        try {
          res = await fetch('/api/network-files/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: item.month, folder: item.folder, file: item.name }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(t);
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro');
        results.push({
          fileName: item.name,
          source: `${item.folder}_${item.month}`,
          data: json.data,
          stats: json.stats,
        });
        setStatus((s) => ({ ...s, [item.key]: 'done' }));
      } catch (e) {
        setStatus((s) => ({ ...s, [item.key]: 'error' }));
        toast.error(`${item.folder}/${item.name}: ${(e as Error).message}`);
      }
    }

    setRunning(false);
    if (results.length) {
      toast.success(`${results.length} fatura(s) extraída(s) com sucesso.`);
      onDone(results);
    }
  };

  const doneCount = Object.values(status).filter((s) => s === 'done' || s === 'error').length;
  const total = Object.keys(status).length;

  // Filter months for display in Step 1
  const filteredMonths = useMemo(() => {
    const q = monthSearch.trim().toLowerCase();
    return q ? months.filter((m) => m.toLowerCase().includes(q)) : months;
  }, [months, monthSearch]);

  const isLoadingAnyFolders = loadingMonths.size > 0;
  const isLoadingAnyFiles = loadingFilesMF.size > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
          <ShieldCheck className="h-3 w-3" /> Somente arquivos autorizados são lidos
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Extração em lote da rede</h1>
        <p className="text-xs text-slate-500 font-mono break-all">{base || '…'}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* ══════════ STEP 1: MONTHS ══════════ */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-800">1. Meses (AAAAMM) — selecione um ou mais</span>
            {selectedMonths.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
                {selectedMonths.length} selecionado{selectedMonths.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={loadMonths}
            disabled={running || loadingBase}
            title="Recarregar meses da rede"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            {loadingBase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>Atualizar</span>
          </button>
        </div>

        {/* Quick select buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-slate-400 mr-1">Atalhos:</span>
          {months.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => selectQuickMonths([months[0]])}
                disabled={running}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
              >
                Último mês ({fmtMonthShort(months[0])})
              </button>
              {months.length >= 3 && (
                <button
                  type="button"
                  onClick={() => selectQuickMonths(months.slice(0, 3))}
                  disabled={running}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                >
                  Últimos 3 meses
                </button>
              )}
              {months.length >= 6 && (
                <button
                  type="button"
                  onClick={() => selectQuickMonths(months.slice(0, 6))}
                  disabled={running}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                >
                  Últimos 6 meses
                </button>
              )}
              {months.some((m) => m.startsWith('2026')) && (
                <button
                  type="button"
                  onClick={() => selectQuickMonths(months.filter((m) => m.startsWith('2026')))}
                  disabled={running}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                >
                  Ano 2026
                </button>
              )}
              {selectedMonths.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMonths([])}
                  disabled={running}
                  className="px-2.5 py-1 rounded-md text-red-600 hover:bg-red-50 text-[11px] font-medium transition-colors ml-auto"
                >
                  Limpar seleção
                </button>
              )}
            </>
          )}
        </div>

        {/* Selected months badges */}
        {selectedMonths.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
            {selectedMonths.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
              >
                {fmtMonthLabel(m)}
                <button
                  type="button"
                  onClick={() => toggleMonth(m)}
                  disabled={running}
                  className="hover:text-blue-900 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search and scrollable month grid */}
        <div className="space-y-2 pt-1">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={monthSearch}
              onChange={(e) => setMonthSearch(e.target.value)}
              placeholder="Buscar mês (ex: 2026, 2025 ou 09)..."
              disabled={running}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50">
            {loadingBase && (
              <p className="text-xs text-slate-400 p-2 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando lista de meses...
              </p>
            )}
            {!loadingBase && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {filteredMonths.map((m) => {
                  const on = selectedMonths.includes(m);
                  return (
                    <label
                      key={m}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                        on
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      } ${running ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleMonth(m)}
                        disabled={running}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                      />
                      <span className="truncate">{fmtMonthShort(m)}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {!loadingBase && filteredMonths.length === 0 && (
              <p className="text-xs text-slate-400 p-2">Nenhum mês encontrado para a busca.</p>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ STEP 2: FOLDERS ══════════ */}
      {selectedMonths.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">
                2. Pastas / Concessionárias — selecione uma ou mais
              </span>
              {selectedFolders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
                  {selectedFolders.length} selecionada{selectedFolders.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {isLoadingAnyFolders && (
              <span className="text-[11px] text-blue-600 flex items-center gap-1.5 font-medium">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando pastas...
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {availableFolders.map((f) => {
              const on = selectedFolders.includes(f.name);
              return (
                <label
                  key={f.name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                    on
                      ? 'bg-blue-50 border-blue-400 text-blue-800 font-medium shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  } ${running ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleFolder(f.name)}
                    disabled={running}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  />
                  <span>{f.name}</span>
                  <span className="text-[11px] text-slate-400">
                    ({f.totalPdfs} PDFs em {f.count} {f.count === 1 ? 'mês' : 'meses'})
                  </span>
                </label>
              );
            })}
            {!isLoadingAnyFolders && availableFolders.length === 0 && (
              <span className="text-xs text-slate-400">Nenhuma pasta com PDFs encontrada nos meses selecionados.</span>
            )}
          </div>
        </div>
      )}

      {/* ══════════ STEP 3: AUTHORIZATION & EXTRACTION ══════════ */}
      {selectedFolders.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-800">
                3. Arquivos para extração ({authorized.size} autorizado{authorized.size !== 1 ? 's' : ''})
              </span>
              {isLoadingAnyFiles && (
                <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium ml-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando arquivos...
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* Search file filter */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar arquivos..."
                  disabled={running}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white w-44 placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Master toggle */}
              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={running || allVisibleFilesCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {allVisibleAuthorized ? (
                  <>
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                    <span>Desautorizar todos</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                    <span>Autorizar todos ({allVisibleFilesCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Groups list */}
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-slate-100">
            {activeGroups.map((g) => {
              const isCollapsed = collapsedGroups.has(g.key);
              const groupAllAuth = isGroupAllAuthorized(g);
              const groupAuthCount = g.allFiles.filter((f) =>
                authorized.has(fileKey(g.month, g.folder, f.name))
              ).length;
              const isLoadingThisGroup = loadingFilesMF.has(g.key);

              return (
                <div key={g.key} className="bg-white">
                  {/* Group header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/90 backdrop-blur-sm border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(g.key)}
                      className="flex items-center gap-2 text-left hover:text-slate-900"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-xs font-bold text-slate-800">
                        {g.folder}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        • {fmtMonthLabel(g.month)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                        {g.allFiles.length} PDFs
                      </span>
                      {groupAuthCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                          {groupAuthCount} autorizado{groupAuthCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      {isLoadingThisGroup && (
                        <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin mr-1" />
                      )}
                      <button
                        type="button"
                        onClick={() => toggleGroupFiles(g)}
                        disabled={running || g.visibleFiles.length === 0}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
                      >
                        {groupAllAuth ? 'Desautorizar pasta' : 'Autorizar pasta'}
                      </button>
                    </div>
                  </div>

                  {/* Group files list */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-50">
                      {isLoadingThisGroup && g.allFiles.length === 0 && (
                        <p className="px-6 py-4 text-xs text-slate-400 flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando lista de arquivos...
                        </p>
                      )}
                      {g.visibleFiles.map((f) => {
                        const k = fileKey(g.month, g.folder, f.name);
                        const isAuth = authorized.has(k);
                        const st = status[k];
                        return (
                          <label
                            key={f.name}
                            className={`flex items-center gap-3 px-6 py-2 text-xs cursor-pointer transition-colors ${
                              isAuth ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isAuth}
                              onChange={() => toggleFile(g.month, g.folder, f.name)}
                              disabled={running}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                            />
                            <span className="flex-1 truncate text-slate-700 font-mono text-[11px]">
                              {f.name}
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono">
                              {fmtSize(f.size)}
                            </span>
                            {st === 'processing' && (
                              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                            )}
                            {st === 'done' && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                            {st === 'error' && (
                              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                            )}
                          </label>
                        );
                      })}
                      {!isLoadingThisGroup && g.visibleFiles.length === 0 && (
                        <p className="px-6 py-3 text-xs text-slate-400">
                          Nenhum arquivo encontrado para o filtro nesta pasta.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>
                <strong className="text-slate-800">{authorized.size}</strong> arquivo{authorized.size !== 1 ? 's' : ''} autorizado{authorized.size !== 1 ? 's' : ''} de{' '}
                <strong className="text-slate-800">{totalAvailableFiles}</strong> em{' '}
                <strong className="text-slate-800">{selectedMonths.length}</strong> mês{selectedMonths.length !== 1 ? 'es' : ''}
              </div>
              {running && total > 0 && (
                <div className="text-blue-600 font-mono text-[11px] font-medium">
                  Processando: {doneCount} de {total} concluído(s)
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={run}
              disabled={running || authorized.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Extrair autorizados ({authorized.size})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
