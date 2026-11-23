import { BRAZIL_SURVEILLANCE_NODES } from '../data/mpoxTimeline';
import { LiveUfNode } from '../types/liveMpox';

interface UfCatalogEntry {
  name: string;
  lat: number;
  lng: number;
  defaultPopulation: number;
  defaultCases: number;
  defaultDeaths: number;
  role: string;
}

const BRAZIL_UF_CATALOG: Record<string, UfCatalogEntry> = {
  SP: {
    name: 'São Paulo',
    lat: -23.5505,
    lng: -46.6333,
    defaultPopulation: 44411238,
    defaultCases: 4120,
    defaultDeaths: 6,
    role: 'Maior concentração nacional; 1º caso de Clado 2b (2022) e 1º caso de Clado 1b (07/03/2025).',
  },
  RJ: {
    name: 'Rio de Janeiro',
    lat: -22.9068,
    lng: -43.1729,
    defaultPopulation: 16054524,
    defaultCases: 1860,
    defaultDeaths: 5,
    role: 'Segundo maior polo de notificações e referência laboratorial Fiocruz/INI.',
  },
  RO: {
    name: 'Rondônia',
    lat: -8.7619,
    lng: -63.9039,
    defaultPopulation: 1581196,
    defaultCases: 1040,
    defaultDeaths: 1,
    role: 'Destaque proporcional no Norte com vigilância intensificada na rede SUS.',
  },
  MG: {
    name: 'Minas Gerais',
    lat: -19.9167,
    lng: -43.9345,
    defaultPopulation: 20539989,
    defaultCases: 890,
    defaultDeaths: 3,
    role: 'Monitoramento regional relevante e resposta clínica para imunossuprimidos.',
  },
  RS: {
    name: 'Rio Grande do Sul',
    lat: -30.0346,
    lng: -51.2177,
    defaultPopulation: 10882965,
    defaultCases: 670,
    defaultDeaths: 1,
    role: 'Vigilância epidemiológica ativa na Região Sul via LACEN-RS.',
  },
  DF: {
    name: 'Distrito Federal',
    lat: -15.7975,
    lng: -47.8919,
    defaultPopulation: 2817381,
    defaultCases: 580,
    defaultDeaths: 0,
    role: 'Centro de coordenação nacional (SVSA/MS) e vigilância integrada.',
  },
  PR: {
    name: 'Paraná',
    lat: -25.4284,
    lng: -49.2733,
    defaultPopulation: 11444380,
    defaultCases: 450,
    defaultDeaths: 0,
    role: 'Vigilância de fronteira e diagnóstico molecular descentralizado.',
  },
  BA: {
    name: 'Bahia',
    lat: -12.9714,
    lng: -38.5014,
    defaultPopulation: 14141626,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Vigilância epidemiológica estadual e diagnóstico LACEN-BA.',
  },
  CE: {
    name: 'Ceará',
    lat: -3.7319,
    lng: -38.5267,
    defaultPopulation: 8794957,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Monitoramento regional no Nordeste via rede LACEN-CE.',
  },
  PE: {
    name: 'Pernambuco',
    lat: -8.0476,
    lng: -34.877,
    defaultPopulation: 9058931,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Polo de vigilância epidemiológica e assistência no Nordeste.',
  },
  SC: {
    name: 'Santa Catarina',
    lat: -27.5954,
    lng: -48.548,
    defaultPopulation: 7610361,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Vigilância integrada na Região Sul (LACEN-SC).',
  },
  GO: {
    name: 'Goiás',
    lat: -16.6869,
    lng: -49.2648,
    defaultPopulation: 7056495,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Monitoramento estadual no Centro-Oeste via SES-GO.',
  },
  AM: {
    name: 'Amazonas',
    lat: -3.119,
    lng: -60.0217,
    defaultPopulation: 3941613,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Vigilância amazônica e diagnóstico molecular ILMD/Fiocruz.',
  },
  PA: {
    name: 'Pará',
    lat: -1.4558,
    lng: -48.4902,
    defaultPopulation: 8120131,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Referência diagnóstica Instituto Evandro Chagas (IEC/MS).',
  },
  ES: {
    name: 'Espírito Santo',
    lat: -20.3155,
    lng: -40.3128,
    defaultPopulation: 3833712,
    defaultCases: 0,
    defaultDeaths: 0,
    role: 'Monitoramento epidemiológico integrado no Sudeste.',
  },
};

export function getReferenceUfNodes(): LiveUfNode[] {
  return BRAZIL_SURVEILLANCE_NODES.map((node) => {
    const cat = BRAZIL_UF_CATALOG[node.uf];
    return {
      ...node,
      cases: cat?.defaultCases ?? 0,
      population: cat?.defaultPopulation ?? 1_000_000,
      deaths: cat?.defaultDeaths ?? 0,
    };
  });
}

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_');
}

function parseNumericValue(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return 0;
  // Handle Brazilian thousands separators like "4.120" or "44.411.238"
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, '')) || 0;
  }
  const normalized = cleaned.replace(',', '.');
  const val = Number(normalized);
  return Number.isFinite(val) ? val : 0;
}

interface RawParsedRow {
  uf: string;
  cases: number;
  population?: number;
  deaths?: number;
  role?: string;
}

function parseJsonRows(text: string): RawParsedRow[] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { data?: unknown }).data)
      ? (parsed as { data: unknown[] }).data
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { ufs?: unknown }).ufs)
        ? (parsed as { ufs: unknown[] }).ufs
        : null;

  if (!list) {
    throw new Error('JSON inválido: espere um array de objetos com colunas "uf" e "casos".');
  }

  const rows: RawParsedRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const normalizedMap: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      normalizedMap[normalizeHeader(k)] = v;
    }
    const ufRaw = String(normalizedMap.uf ?? normalizedMap.estado ?? normalizedMap.sigla ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(ufRaw)) continue;

    const cases = parseNumericValue(
      normalizedMap.casos ?? normalizedMap.casos_confirmados ?? normalizedMap.cases ?? normalizedMap.total_cases
    );
    const population = parseNumericValue(
      normalizedMap.populacao ?? normalizedMap.populacao_estimada ?? normalizedMap.population ?? normalizedMap.pop
    );
    const deaths = parseNumericValue(
      normalizedMap.obitos ?? normalizedMap.deaths ?? normalizedMap.mortes
    );
    const roleRaw = normalizedMap.nota ?? normalizedMap.observacao ?? normalizedMap.role;

    rows.push({
      uf: ufRaw,
      cases: Math.max(0, Math.round(cases)),
      population: population > 0 ? Math.round(population) : undefined,
      deaths: Math.max(0, Math.round(deaths)),
      role: typeof roleRaw === 'string' && roleRaw.trim() ? roleRaw.trim() : undefined,
    });
  }

  return rows;
}

function parseCsvRows(text: string): RawParsedRow[] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV precisa conter cabeçalho e ao menos uma linha de dados.');
  }

  const headerLine = lines[0];
  const delimiter = headerLine.split(';').length > headerLine.split(',').length ? ';' : ',';
  const headers = headerLine.split(delimiter).map(normalizeHeader);

  const ufIdx = headers.findIndex((h) => h === 'uf' || h === 'estado' || h === 'sigla');
  const casesIdx = headers.findIndex(
    (h) => h === 'casos' || h === 'casos_confirmados' || h === 'cases' || h === 'total_cases'
  );
  const popIdx = headers.findIndex(
    (h) => h === 'populacao' || h === 'populacao_estimada' || h === 'population' || h === 'pop'
  );
  const deathsIdx = headers.findIndex(
    (h) => h === 'obitos' || h === 'deaths' || h === 'mortes'
  );
  const roleIdx = headers.findIndex(
    (h) => h === 'nota' || h === 'observacao' || h === 'role' || h === 'descricao'
  );

  if (ufIdx === -1 || casesIdx === -1) {
    throw new Error(
      'Cabeçalho não reconhecido. Inclua ao menos as colunas "uf" e "casos" (ex.: uf,casos,populacao,obitos).'
    );
  }

  const rows: RawParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    const ufRaw = (cols[ufIdx] ?? '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(ufRaw)) continue;

    const cases = Math.max(0, Math.round(parseNumericValue(cols[casesIdx])));
    const population = popIdx >= 0 ? Math.round(parseNumericValue(cols[popIdx])) : 0;
    const deaths = deathsIdx >= 0 ? Math.max(0, Math.round(parseNumericValue(cols[deathsIdx]))) : 0;
    const role = roleIdx >= 0 && cols[roleIdx] ? cols[roleIdx] : undefined;

    rows.push({
      uf: ufRaw,
      cases,
      population: population > 0 ? population : undefined,
      deaths,
      role,
    });
  }

  return rows;
}

export function parseUfFeedContent(rawText: string): LiveUfNode[] {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('Arquivo ou feed vazio.');
  }

  const rawRows = trimmed.startsWith('[') || trimmed.startsWith('{')
    ? parseJsonRows(trimmed)
    : parseCsvRows(trimmed);

  if (rawRows.length === 0) {
    throw new Error('Nenhuma UF brasileira válida (2 letras, ex.: SP, RJ, RO) foi encontrada.');
  }

  // Deduplicate by UF (summing if repeated)
  const merged = new Map<string, RawParsedRow>();
  for (const row of rawRows) {
    const prev = merged.get(row.uf);
    if (prev) {
      prev.cases += row.cases;
      prev.deaths = (prev.deaths ?? 0) + (row.deaths ?? 0);
      if (row.population) prev.population = row.population;
      if (row.role) prev.role = row.role;
    } else {
      merged.set(row.uf, { ...row });
    }
  }

  const sorted = Array.from(merged.values()).sort((a, b) => b.cases - a.cases);
  const totalCases = sorted.reduce((acc, r) => acc + r.cases, 0);

  return sorted.map((row, idx): LiveUfNode => {
    const cat = BRAZIL_UF_CATALOG[row.uf];
    const sharePercent = totalCases > 0 ? (row.cases / totalCases) * 100 : 0;
    const tier: LiveUfNode['tier'] =
      idx === 0 ? 'principal' : idx <= 2 ? 'secundario' : 'vigilancia';

    return {
      uf: row.uf,
      name: cat?.name ?? row.uf,
      lat: cat?.lat ?? -15.7975,
      lng: cat?.lng ?? -47.8919,
      tier,
      sharePercent: Number(sharePercent.toFixed(1)),
      cases: row.cases,
      population: row.population ?? cat?.defaultPopulation ?? 5_000_000,
      deaths: row.deaths ?? 0,
      role:
        row.role ??
        cat?.role ??
        `Dados sincronizados via repositório externo (${row.cases.toLocaleString('pt-BR')} casos registrados).`,
    };
  });
}

export const SAMPLE_UF_CSV_TEMPLATE = [
  'uf,casos,populacao,obitos,nota',
  'SP,4120,44411238,6,Maior concentração nacional e vigilância genômica IAL',
  'RJ,1860,16054524,5,Referência laboratorial Fiocruz/INI e vigilância estadual',
  'RO,1040,1581196,1,Destaque proporcional na Região Norte (rede SUS)',
  'MG,890,20539989,3,Monitoramento regional e atenção a imunossuprimidos',
  'RS,670,10882965,1,Vigilância ativa na Região Sul via LACEN-RS',
  'DF,580,2817381,0,Coordenação nacional SVSA/MS',
  'PR,450,11444380,0,Vigilância de fronteira e diagnóstico molecular',
].join('\n');
