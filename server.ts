import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CountryLiveStats, LiveMpoxSnapshot, MonthlyTrendPoint } from './src/types/liveMpox';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const OWID_PRIMARY_URL =
  'https://catalog.ourworldindata.org/explorers/who/latest/monkeypox/monkeypox.csv';
const OWID_FALLBACK_URL =
  'https://raw.githubusercontent.com/owid/monkeypox/main/owid-monkeypox-data.csv';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REMOTE_FEED_MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap

const TRACKED_COUNTRIES = new Set([
  'World',
  'Brazil',
  'Democratic Republic of Congo',
  'United States',
  'United Kingdom',
  'Denmark',
]);

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const mIdx = Number(m) - 1;
  const mon = PT_MONTHS[mIdx] ?? m;
  return `${mon}/${y.slice(2)}`;
}

function numOrZero(val: string | undefined): number {
  if (!val) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function buildCountryStats(
  location: string,
  isoCode: string,
  date: string,
  totalCases: number,
  totalDeaths: number,
  newCases: number,
  newCasesSmoothed: number,
  totalCasesPerMillion: number
): CountryLiveStats {
  const fatalityPct = totalCases > 0 ? (totalDeaths / totalCases) * 100 : 0;
  const estimatedPopulation =
    totalCases > 0 && totalCasesPerMillion > 0
      ? Math.round((totalCases / totalCasesPerMillion) * 1_000_000)
      : null;

  return {
    location,
    isoCode,
    date,
    totalCases: Math.round(totalCases),
    totalDeaths: Math.round(totalDeaths),
    newCases: Math.round(newCases),
    newCasesSmoothed: Number(newCasesSmoothed.toFixed(1)),
    totalCasesPerMillion: Number(totalCasesPerMillion.toFixed(2)),
    fatalityPct: Number(fatalityPct.toFixed(2)),
    estimatedPopulation,
  };
}

function parseOwidCsv(
  csvText: string,
  sourceUrl: string,
  sourceLastModified: string | null
): LiveMpoxSnapshot {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV oficial vazio ou incompleto.');
  }

  const header = lines[0].split(',').map((h) => h.trim());
  const idxLocation = header.indexOf('location');
  const idxDate = header.indexOf('date');
  const idxIso = header.indexOf('iso_code');
  const idxTotalCases = header.indexOf('total_cases');
  const idxTotalDeaths = header.indexOf('total_deaths');
  const idxNewCases = header.indexOf('new_cases');
  const idxNewCasesSmoothed = header.indexOf('new_cases_smoothed');
  const idxTotalCasesPerMillion = header.indexOf('total_cases_per_million');

  if (idxLocation === -1 || idxDate === -1 || idxTotalCases === -1) {
    throw new Error('Esquema CSV inesperado na fonte OMS/OWID.');
  }

  const latestByLocation = new Map<string, CountryLiveStats>();
  const monthlyMap = new Map<string, { globalNewCases: number; brazilNewCases: number }>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(',');
    const location = cols[idxLocation];
    if (!location) continue;
    const date = cols[idxDate];
    if (!date || date.length < 7) continue;

    const isoCode = idxIso >= 0 ? cols[idxIso] || '' : '';
    const totalCases = numOrZero(cols[idxTotalCases]);
    const totalDeaths = idxTotalDeaths >= 0 ? numOrZero(cols[idxTotalDeaths]) : 0;
    const newCases = idxNewCases >= 0 ? numOrZero(cols[idxNewCases]) : 0;
    const newCasesSmoothed = idxNewCasesSmoothed >= 0 ? numOrZero(cols[idxNewCasesSmoothed]) : 0;
    const totalCasesPerMillion =
      idxTotalCasesPerMillion >= 0 ? numOrZero(cols[idxTotalCasesPerMillion]) : 0;

    // Accumulate monthly new cases for Global & Brazil trend chart
    if (location === 'World' || location === 'Brazil') {
      const ym = date.slice(0, 7);
      let entry = monthlyMap.get(ym);
      if (!entry) {
        entry = { globalNewCases: 0, brazilNewCases: 0 };
        monthlyMap.set(ym, entry);
      }
      if (location === 'World') entry.globalNewCases += Math.max(0, newCases);
      else entry.brazilNewCases += Math.max(0, newCases);
    }

    // Track latest record per country (ISO3) or tracked aggregate (World)
    const isIsoCountry = /^[A-Z]{3}$/.test(isoCode);
    if (!isIsoCountry && !TRACKED_COUNTRIES.has(location)) continue;

    const prev = latestByLocation.get(location);
    if (!prev || date >= prev.date) {
      latestByLocation.set(
        location,
        buildCountryStats(
          location,
          isoCode,
          date,
          totalCases,
          totalDeaths,
          newCases,
          newCasesSmoothed,
          totalCasesPerMillion
        )
      );
    }
  }

  const fallbackEmpty = (name: string, iso: string): CountryLiveStats =>
    buildCountryStats(name, iso, '', 0, 0, 0, 0, 0);

  const globalStats = latestByLocation.get('World') ?? fallbackEmpty('World', 'OWID_WRL');
  const brazilStats = latestByLocation.get('Brazil') ?? fallbackEmpty('Brazil', 'BRA');

  const countries: Record<string, CountryLiveStats> = {};
  for (const key of TRACKED_COUNTRIES) {
    if (key === 'World') continue;
    const found = latestByLocation.get(key);
    if (found) countries[key] = found;
  }

  const topCountries = Array.from(latestByLocation.values())
    .filter((c) => /^[A-Z]{3}$/.test(c.isoCode) && c.totalCases > 0)
    .sort((a, b) => b.totalCases - a.totalCases)
    .slice(0, 8);

  const sortedMonths = Array.from(monthlyMap.keys()).sort();
  // Take last 18 active months with non-zero global activity
  const nonZeroMonths = sortedMonths.filter((m) => {
    const v = monthlyMap.get(m);
    return v && (v.globalNewCases > 0 || v.brazilNewCases > 0);
  });
  const recentMonths = (nonZeroMonths.length > 0 ? nonZeroMonths : sortedMonths).slice(-18);

  const monthlyTrend: MonthlyTrendPoint[] = recentMonths.map((ym) => {
    const v = monthlyMap.get(ym) ?? { globalNewCases: 0, brazilNewCases: 0 };
    return {
      month: ym,
      label: formatMonthLabel(ym),
      globalNewCases: Math.round(v.globalNewCases),
      brazilNewCases: Math.round(v.brazilNewCases),
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    sourceName: 'OMS / Our World in Data (WHO Mpox Surveillance)',
    sourceUrl,
    sourceLastModified,
    global: globalStats,
    brazil: brazilStats,
    countries,
    topCountries,
    monthlyTrend,
  };
}

let cachedSnapshot: LiveMpoxSnapshot | null = null;
let cachedAtMs = 0;
let inflightFetch: Promise<LiveMpoxSnapshot> | null = null;
const sseClients = new Set<Response>();

function broadcastSseSnapshot(snapshot: LiveMpoxSnapshot): void {
  const payload = `event: mpox-update\ndata: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function fetchLiveSnapshotFromOrigin(): Promise<LiveMpoxSnapshot> {
  const urls = [OWID_PRIMARY_URL, OWID_FALLBACK_URL];
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Atlas-Mpox-SUS-Extension/1.0',
          Accept: 'text/csv,text/plain,*/*',
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao consultar ${url}`);
      }

      const lastModified = response.headers.get('last-modified');
      const csvText = await response.text();
      const parsed = parseOwidCsv(csvText, url, lastModified);
      cachedSnapshot = parsed;
      cachedAtMs = Date.now();
      broadcastSseSnapshot(parsed);
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Não foi possível obter os dados oficiais OMS/OWID.');
}

async function getLiveSnapshot(forceRefresh = false): Promise<LiveMpoxSnapshot> {
  const isFresh = cachedSnapshot !== null && Date.now() - cachedAtMs < CACHE_TTL_MS;
  if (!forceRefresh && isFresh && cachedSnapshot) {
    return cachedSnapshot;
  }

  if (!inflightFetch) {
    inflightFetch = fetchLiveSnapshotFromOrigin().finally(() => {
      inflightFetch = null;
    });
  }

  try {
    return await inflightFetch;
  } catch (err) {
    // Serve stale cache if origin temporarily fails
    if (cachedSnapshot) return cachedSnapshot;
    throw err;
  }
}

function normalizeGitHubUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    // Convert https://github.com/owner/repo/blob/branch/path.csv -> raw.githubusercontent.com
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 5 && parts[2] === 'blob') {
        const [owner, repo, , branch, ...rest] = parts;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join('/')}`;
      }
    }
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

function isSafeExternalHttpsUrl(rawUrl: string): { ok: boolean; normalized?: string; reason?: string } {
  const normalized = normalizeGitHubUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, reason: 'URL inválida. Informe um endereço HTTPS completo.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Apenas URLs seguras HTTPS são permitidas.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^\[?(fe80|fc|fd)/i.test(host)
  ) {
    return { ok: false, reason: 'Endereços de rede privada ou locais não são permitidos.' };
  }

  return { ok: true, normalized };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  const httpServer = http.createServer(app);

  // 1. Live official WHO / OWID Mpox Surveillance JSON API
  app.get('/api/mpox-live', async (req: Request, res: Response) => {
    try {
      const force = req.query.refresh === '1' || req.query.refresh === 'true';
      const data = await getLiveSnapshot(force);
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar dados oficiais.';
      res.status(502).json({ error: message });
    }
  });

  // 2. Real-time Server-Sent Events stream for live surveillance updates
  app.get('/api/mpox-stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(': connected\n\n');

    try {
      const snapshot = await getLiveSnapshot(false);
      res.write(`event: mpox-update\ndata: ${JSON.stringify(snapshot)}\n\n`);
    } catch {
      res.write(`event: mpox-error\ndata: ${JSON.stringify({ message: 'Aguardando sincronização OMS.' })}\n\n`);
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 30_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // 3. CORS-safe proxy for syncing custom GitHub Raw CSV/JSON or Google Sheets published CSV
  app.get('/api/fetch-remote-feed', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const check = isSafeExternalHttpsUrl(rawUrl);
    if (!check.ok || !check.normalized) {
      res.status(400).json({ error: check.reason ?? 'URL inválida.' });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const upstream = await fetch(check.normalized, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Atlas-Mpox-SUS-Extension/1.0',
          Accept: 'text/csv,application/json,text/plain,*/*',
        },
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(502).json({
          error: `O repositório remoto retornou HTTP ${upstream.status}. Verifique se o arquivo é público.`,
        });
        return;
      }

      const contentLength = Number(upstream.headers.get('content-length') || 0);
      if (contentLength > REMOTE_FEED_MAX_BYTES) {
        res.status(413).json({ error: 'Arquivo remoto excede o limite de 2 MB.' });
        return;
      }

      const text = await upstream.text();
      if (Buffer.byteLength(text, 'utf8') > REMOTE_FEED_MAX_BYTES) {
        res.status(413).json({ error: 'Arquivo remoto excede o limite de 2 MB.' });
        return;
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        resolvedUrl: check.normalized,
        fetchedAt: new Date().toISOString(),
        content: text,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Tempo limite esgotado ao conectar ao repositório remoto.'
          : 'Não foi possível ler a URL informada. Verifique se o link está acessível.';
      res.status(502).json({ error: message });
    }
  });

  // Background periodic server cache refresh (every 15 min) while clients are connected
  setInterval(() => {
    if (sseClients.size > 0) {
      getLiveSnapshot(true).catch(() => {
        // Keep last valid snapshot if upstream blips
      });
    }
  }, CACHE_TTL_MS);

  // Mount Vite middleware in dev, or serve static dist/ in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build não encontrado.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Atlas Mpox] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor Atlas Mpox:', err);
  process.exit(1);
});
