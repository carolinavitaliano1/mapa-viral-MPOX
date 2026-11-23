import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AutoRefreshMode,
  CountryLiveStats,
  CustomFeedMeta,
  LiveMpoxSnapshot,
  LiveUfNode,
  MonthlyTrendPoint,
} from '../types/liveMpox';
import { getReferenceUfNodes, parseUfFeedContent } from '../utils/ufFeedParser';

const STORAGE_AUTO_REFRESH = 'atlas_mpox_auto_refresh';
const STORAGE_CUSTOM_URL = 'atlas_mpox_custom_uf_url';

const OWID_DIRECT_URL =
  'https://catalog.ourworldindata.org/explorers/who/latest/monkeypox/monkeypox.csv';

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return `${PT_MONTHS[idx] ?? m}/${y.slice(2)}`;
}

function numOrZero(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Client-side fallback parser if backend /api/mpox-live is unavailable (static deployment)
function parseOwidClientFallback(csvText: string, sourceUrl: string): LiveMpoxSnapshot {
  const lines = csvText.split(/\r?\n/);
  const header = (lines[0] ?? '').split(',').map((h) => h.trim());
  const idxLocation = header.indexOf('location');
  const idxDate = header.indexOf('date');
  const idxIso = header.indexOf('iso_code');
  const idxTotalCases = header.indexOf('total_cases');
  const idxTotalDeaths = header.indexOf('total_deaths');
  const idxNewCases = header.indexOf('new_cases');
  const idxNewCasesSmoothed = header.indexOf('new_cases_smoothed');
  const idxTotalCasesPerMillion = header.indexOf('total_cases_per_million');

  const tracked = new Set([
    'World',
    'Brazil',
    'Democratic Republic of Congo',
    'United States',
    'United Kingdom',
    'Denmark',
  ]);

  const latest = new Map<string, CountryLiveStats>();
  const monthly = new Map<string, { g: number; b: number }>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(',');
    const location = cols[idxLocation];
    const date = cols[idxDate];
    if (!location || !date || date.length < 7) continue;

    const iso = idxIso >= 0 ? cols[idxIso] || '' : '';
    const tc = numOrZero(cols[idxTotalCases]);
    const td = idxTotalDeaths >= 0 ? numOrZero(cols[idxTotalDeaths]) : 0;
    const nc = idxNewCases >= 0 ? numOrZero(cols[idxNewCases]) : 0;
    const ncs = idxNewCasesSmoothed >= 0 ? numOrZero(cols[idxNewCasesSmoothed]) : 0;
    const tcpm = idxTotalCasesPerMillion >= 0 ? numOrZero(cols[idxTotalCasesPerMillion]) : 0;

    if (location === 'World' || location === 'Brazil') {
      const ym = date.slice(0, 7);
      const entry = monthly.get(ym) ?? { g: 0, b: 0 };
      if (location === 'World') entry.g += Math.max(0, nc);
      else entry.b += Math.max(0, nc);
      monthly.set(ym, entry);
    }

    const isIso3 = /^[A-Z]{3}$/.test(iso);
    if (!isIso3 && !tracked.has(location)) continue;

    const prev = latest.get(location);
    if (!prev || date >= prev.date) {
      const fatalityPct = tc > 0 ? (td / tc) * 100 : 0;
      const estimatedPopulation = tc > 0 && tcpm > 0 ? Math.round((tc / tcpm) * 1_000_000) : null;
      latest.set(location, {
        location,
        isoCode: iso,
        date,
        totalCases: Math.round(tc),
        totalDeaths: Math.round(td),
        newCases: Math.round(nc),
        newCasesSmoothed: Number(ncs.toFixed(1)),
        totalCasesPerMillion: Number(tcpm.toFixed(2)),
        fatalityPct: Number(fatalityPct.toFixed(2)),
        estimatedPopulation,
      });
    }
  }

  const empty = (loc: string, iso: string): CountryLiveStats => ({
    location: loc,
    isoCode: iso,
    date: '',
    totalCases: 0,
    totalDeaths: 0,
    newCases: 0,
    newCasesSmoothed: 0,
    totalCasesPerMillion: 0,
    fatalityPct: 0,
    estimatedPopulation: null,
  });

  const countries: Record<string, CountryLiveStats> = {};
  for (const name of tracked) {
    if (name === 'World') continue;
    const found = latest.get(name);
    if (found) countries[name] = found;
  }

  const topCountries = Array.from(latest.values())
    .filter((c) => /^[A-Z]{3}$/.test(c.isoCode) && c.totalCases > 0)
    .sort((a, b) => b.totalCases - a.totalCases)
    .slice(0, 8);

  const activeMonths = Array.from(monthly.keys())
    .sort()
    .filter((m) => {
      const v = monthly.get(m);
      return v && (v.g > 0 || v.b > 0);
    })
    .slice(-18);

  const monthlyTrend: MonthlyTrendPoint[] = activeMonths.map((ym) => {
    const v = monthly.get(ym) ?? { g: 0, b: 0 };
    return {
      month: ym,
      label: formatMonthLabel(ym),
      globalNewCases: Math.round(v.g),
      brazilNewCases: Math.round(v.b),
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    sourceName: 'OMS / Our World in Data (Conexão Direta)',
    sourceUrl,
    sourceLastModified: null,
    global: latest.get('World') ?? empty('World', 'OWID_WRL'),
    brazil: latest.get('Brazil') ?? empty('Brazil', 'BRA'),
    countries,
    topCountries,
    monthlyTrend,
  };
}

export interface LiveMpoxController {
  snapshot: LiveMpoxSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  sseConnected: boolean;
  autoRefresh: AutoRefreshMode;
  setAutoRefresh: (mode: AutoRefreshMode) => void;
  refreshNow: () => Promise<void>;
  ufNodes: LiveUfNode[];
  customFeedUrl: string;
  customFeedMeta: CustomFeedMeta;
  customFeedLoading: boolean;
  customFeedError: string | null;
  syncRemoteFeed: (url: string) => Promise<boolean>;
  importLocalCsv: (rawText: string, fileName: string) => boolean;
  resetUfData: () => void;
}

const REFERENCE_META: CustomFeedMeta = {
  kind: 'reference',
  label: 'Base educativa de referência SUS',
  updatedAt: new Date().toISOString(),
  rowCount: 7,
};

export function useLiveMpoxData(): LiveMpoxController {
  const [snapshot, setSnapshot] = useState<LiveMpoxSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const [autoRefresh, setAutoRefreshState] = useState<AutoRefreshMode>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_AUTO_REFRESH);
      if (saved === 'off' || saved === '5m' || saved === '15m') return saved;
    } catch {
      // Ignore storage error
    }
    return '5m';
  });

  const [ufNodes, setUfNodes] = useState<LiveUfNode[]>(() => getReferenceUfNodes());
  const [customFeedUrl, setCustomFeedUrl] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_CUSTOM_URL) ?? '';
    } catch {
      return '';
    }
  });
  const [customFeedMeta, setCustomFeedMeta] = useState<CustomFeedMeta>(REFERENCE_META);
  const [customFeedLoading, setCustomFeedLoading] = useState<boolean>(false);
  const [customFeedError, setCustomFeedError] = useState<string | null>(null);

  const customFeedUrlRef = useRef(customFeedUrl);
  customFeedUrlRef.current = customFeedUrl;

  const setAutoRefresh = useCallback((mode: AutoRefreshMode) => {
    setAutoRefreshState(mode);
    try {
      window.localStorage.setItem(STORAGE_AUTO_REFRESH, mode);
    } catch {
      // Ignore
    }
  }, []);

  const fetchOfficialFeed = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    setError(null);
    try {
      const endpoint = forceRefresh ? '/api/mpox-live?refresh=1' : '/api/mpox-live';
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as LiveMpoxSnapshot;
        if (data && data.global && data.brazil) {
          setSnapshot(data);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // Graceful client-side CORS fallback directly to OWID official WHO CSV
      const directRes = await fetch(OWID_DIRECT_URL);
      if (!directRes.ok) {
        throw new Error(`Falha ao consultar OMS/OWID (HTTP ${directRes.status}).`);
      }
      const csv = await directRes.text();
      const parsed = parseOwidClientFallback(csv, OWID_DIRECT_URL);
      setSnapshot(parsed);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível sincronizar os dados oficiais agora.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const syncRemoteFeed = useCallback(async (urlInput: string): Promise<boolean> => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setCustomFeedError('Informe a URL HTTPS de um arquivo CSV ou JSON público (ex.: GitHub Raw).');
      return false;
    }

    setCustomFeedLoading(true);
    setCustomFeedError(null);
    try {
      let rawText = '';
      let resolvedUrl = trimmed;

      // Prefer CORS-safe backend proxy
      const proxyRes = await fetch(`/api/fetch-remote-feed?url=${encodeURIComponent(trimmed)}`, {
        headers: { Accept: 'application/json' },
      });
      const proxyType = proxyRes.headers.get('content-type') || '';

      if (proxyType.includes('application/json')) {
        const payload = (await proxyRes.json()) as {
          content?: string;
          resolvedUrl?: string;
          error?: string;
        };
        if (!proxyRes.ok) {
          throw new Error(payload.error ?? `Erro HTTP ${proxyRes.status} ao ler repositório.`);
        }
        rawText = payload.content ?? '';
        resolvedUrl = payload.resolvedUrl ?? trimmed;
      } else {
        // Direct fetch fallback if running statically
        const direct = await fetch(trimmed);
        if (!direct.ok) throw new Error(`HTTP ${direct.status} ao acessar URL.`);
        rawText = await direct.text();
      }

      const nodes = parseUfFeedContent(rawText);
      setUfNodes(nodes);
      setCustomFeedUrl(trimmed);
      try {
        window.localStorage.setItem(STORAGE_CUSTOM_URL, trimmed);
      } catch {
        // Ignore
      }

      let hostLabel = 'Repositório remoto';
      try {
        const u = new URL(resolvedUrl);
        const file = u.pathname.split('/').filter(Boolean).pop() ?? 'dados';
        hostLabel = `${u.hostname}/${file}`;
      } catch {
        // Keep fallback
      }

      setCustomFeedMeta({
        kind: 'remote',
        label: hostLabel,
        url: resolvedUrl,
        updatedAt: new Date().toISOString(),
        rowCount: nodes.length,
      });
      setCustomFeedLoading(false);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível importar o repositório informado.';
      setCustomFeedError(msg);
      setCustomFeedLoading(false);
      return false;
    }
  }, []);

  const importLocalCsv = useCallback((rawText: string, fileName: string): boolean => {
    setCustomFeedError(null);
    try {
      const nodes = parseUfFeedContent(rawText);
      setUfNodes(nodes);
      setCustomFeedMeta({
        kind: 'local',
        label: `Arquivo local · ${fileName}`,
        updatedAt: new Date().toISOString(),
        rowCount: nodes.length,
      });
      return true;
    } catch (err) {
      setCustomFeedError(
        err instanceof Error ? err.message : 'Não foi possível interpretar o arquivo selecionado.'
      );
      return false;
    }
  }, []);

  const resetUfData = useCallback(() => {
    setUfNodes(getReferenceUfNodes());
    setCustomFeedUrl('');
    setCustomFeedError(null);
    setCustomFeedMeta({
      ...REFERENCE_META,
      updatedAt: new Date().toISOString(),
    });
    try {
      window.localStorage.removeItem(STORAGE_CUSTOM_URL);
    } catch {
      // Ignore
    }
  }, []);

  const refreshNow = useCallback(async () => {
    const tasks: Promise<unknown>[] = [fetchOfficialFeed(true)];
    if (customFeedUrlRef.current) {
      tasks.push(syncRemoteFeed(customFeedUrlRef.current));
    }
    await Promise.all(tasks);
  }, [fetchOfficialFeed, syncRemoteFeed]);

  // Initial load + restore saved remote repository URL if configured
  useEffect(() => {
    fetchOfficialFeed(false);
    if (customFeedUrlRef.current) {
      syncRemoteFeed(customFeedUrlRef.current);
    }
  }, [fetchOfficialFeed, syncRemoteFeed]);

  // Real-time Server-Sent Events subscription
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    try {
      source = new EventSource('/api/mpox-stream');
      source.onopen = () => setSseConnected(true);
      source.addEventListener('mpox-update', (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data) as LiveMpoxSnapshot;
          if (parsed && parsed.global && parsed.brazil) {
            setSnapshot(parsed);
            setLoading(false);
            setError(null);
          }
        } catch {
          // Ignore malformed frame
        }
      });
      source.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }
    return () => {
      source?.close();
      setSseConnected(false);
    };
  }, []);

  // Periodic automatic polling according to user preference
  useEffect(() => {
    if (autoRefresh === 'off') return;
    const intervalMs = autoRefresh === '5m' ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const id = window.setInterval(() => {
      refreshNow();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshNow]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    sseConnected,
    autoRefresh,
    setAutoRefresh,
    refreshNow,
    ufNodes,
    customFeedUrl,
    customFeedMeta,
    customFeedLoading,
    customFeedError,
    syncRemoteFeed,
    importLocalCsv,
    resetUfData,
  };
}
