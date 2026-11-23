import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Calculator,
  Database,
  Download,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { LiveMpoxController } from '../hooks/useLiveMpoxData';
import { AutoRefreshMode, CountryLiveStats } from '../types/liveMpox';
import { SAMPLE_UF_CSV_TEMPLATE } from '../utils/ufFeedParser';

interface LiveSurveillancePanelProps {
  liveData: LiveMpoxController;
  onApplyToCalculator: (payload: {
    label: string;
    cases: number;
    population: number;
    deaths: number;
  }) => void;
}

const COUNTRY_NAME_PT: Record<string, string> = {
  World: 'Mundo (OMS)',
  Brazil: 'Brasil',
  'Democratic Republic of Congo': 'Rep. Dem. do Congo',
  'United States': 'Estados Unidos',
  'United Kingdom': 'Reino Unido',
  Spain: 'Espanha',
  Colombia: 'Colômbia',
  France: 'França',
  Mexico: 'México',
  Peru: 'Peru',
  Germany: 'Alemanha',
  Burundi: 'Burundi',
  Uganda: 'Uganda',
  Denmark: 'Dinamarca',
};

function formatPtDate(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatPtTime(isoTs: string): string {
  try {
    return new Date(isoTs).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function translateCountry(name: string): string {
  return COUNTRY_NAME_PT[name] ?? name;
}

export const LiveSurveillancePanel: React.FC<LiveSurveillancePanelProps> = ({
  liveData,
  onApplyToCalculator,
}) => {
  const {
    snapshot,
    loading,
    refreshing,
    error,
    autoRefresh,
    setAutoRefresh,
    refreshNow,
    customFeedUrl,
    customFeedMeta,
    customFeedLoading,
    customFeedError,
    syncRemoteFeed,
    importLocalCsv,
    resetUfData,
  } = liveData;

  const [repoDrawerOpen, setRepoDrawerOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(customFeedUrl);
  const [trendSeries, setTrendSeries] = useState<'global' | 'brazil'>('global');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncNotice(null);
    const ok = await syncRemoteFeed(urlInput);
    if (ok) {
      setSyncNotice('Repositório sincronizado: gráficos por UF, calculadora e colunas 3D atualizados.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncNotice(null);
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const ok = importLocalCsv(content, file.name);
      if (ok) {
        setSyncNotice(`Arquivo "${file.name}" importado e aplicado em tempo real.`);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_UF_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mpox_uf_modelo.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyCountryToCalc = (stats: CountryLiveStats, fallbackPop: number) => {
    onApplyToCalculator({
      label: translateCountry(stats.location),
      cases: stats.totalCases,
      population: stats.estimatedPopulation ?? fallbackPop,
      deaths: stats.totalDeaths,
    });
  };

  const kpiCards: {
    key: string;
    title: string;
    subtitle: string;
    stats: CountryLiveStats | undefined;
    fallbackPop: number;
    accent: 'cobalt' | 'crimson' | 'teal';
  }[] = [
    {
      key: 'global',
      title: 'Mundo · OMS',
      subtitle: 'Acumulado global oficial',
      stats: snapshot?.global,
      fallbackPop: 8_100_000_000,
      accent: 'cobalt',
    },
    {
      key: 'brazil',
      title: 'Brasil · OMS',
      subtitle: 'Série nacional consolidada',
      stats: snapshot?.brazil,
      fallbackPop: 212_600_000,
      accent: 'crimson',
    },
    {
      key: 'drc',
      title: 'Rep. Dem. do Congo',
      subtitle: 'Foco epidemiológico Clado 1b',
      stats: snapshot?.countries['Democratic Republic of Congo'],
      fallbackPop: 105_700_000,
      accent: 'crimson',
    },
    {
      key: 'usa',
      title: 'Estados Unidos',
      subtitle: 'Referência Américas (Clado 2b)',
      stats: snapshot?.countries['United States'],
      fallbackPop: 341_800_000,
      accent: 'teal',
    },
  ];

  const trendPoints = snapshot?.monthlyTrend ?? [];
  const maxTrendVal = Math.max(
    1,
    ...trendPoints.map((p) => (trendSeries === 'global' ? p.globalNewCases : p.brazilNewCases))
  );
  const hoveredPoint = hoveredBarIdx !== null ? trendPoints[hoveredBarIdx] ?? null : null;

  const refreshOptions: { value: AutoRefreshMode; label: string }[] = [
    { value: 'off', label: 'Manual' },
    { value: '5m', label: '5 min' },
    { value: '15m', label: '15 min' },
  ];

  return (
    <section
      className="mt-8 rounded-xl border border-[#CBD5E1] bg-white p-5 sm:p-6"
      aria-label="Monitoramento epidemiológico em tempo real"
    >
      {/* Top Control Header */}
      <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-display text-lg font-semibold text-[#0F172A]">
              Vigilância em Tempo Real · Fonte Oficial OMS / OWID
            </h2>
            <span className="font-mono text-[11px] font-semibold text-[#047857]">
              {loading
                ? 'Sincronizando...'
                : snapshot
                  ? `Atualizado às ${formatPtTime(snapshot.fetchedAt)}`
                  : 'Aguardando conexão'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#475569]">
            Série pública da Organização Mundial da Saúde (via Our World in Data) com atualização
            automática e sincronização direta de bases por UF via repositório GitHub ou arquivo CSV.
          </p>
        </div>

        {/* Refresh & Repository Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-lg border border-[#CBD5E1] bg-[#F1F5F9] p-0.5"
            role="group"
            aria-label="Intervalo de atualização automática"
          >
            {refreshOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAutoRefresh(opt.value)}
                aria-pressed={autoRefresh === opt.value}
                className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] font-medium transition-colors ${
                  autoRefresh === opt.value
                    ? 'bg-white text-[#0052A3] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => refreshNow()}
            disabled={refreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#0052A3]' : ''}`}
              aria-hidden="true"
            />
            <span>{refreshing ? 'Atualizando' : 'Atualizar agora'}</span>
          </button>

          <button
            type="button"
            onClick={() => setRepoDrawerOpen((v) => !v)}
            aria-expanded={repoDrawerOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              repoDrawerOpen || customFeedMeta.kind !== 'reference'
                ? 'border-[#0052A3] bg-[#E6F0FA] text-[#0052A3]'
                : 'border-[#CBD5E1] bg-white text-[#1E293B] hover:border-[#0052A3] hover:text-[#0052A3]'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Repositório / CSV</span>
          </button>
        </div>
      </div>

      {/* Error banner if official upstream is temporarily unreachable */}
      {error && (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#991B1B]">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#C81E3A]" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Expandable Live GitHub Repository / CSV Sync Drawer */}
      {repoDrawerOpen && (
        <div className="mt-4 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                <Database className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
                <span>Sincronizar Dados por UF via Repositório Real (GitHub CSV/JSON)</span>
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#475569]">
                Cole o link público de um arquivo CSV ou JSON no GitHub (ou Google Sheets publicado
                em CSV) com colunas <code className="font-mono font-semibold text-[#0052A3]">uf,casos,populacao,obitos</code>.
                Ao atualizar o arquivo no repositório, o Atlas atualiza o gráfico por UF, a
                calculadora e as colunas 3D do Globo automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Baixar modelo CSV</span>
            </button>
          </div>

          <form onSubmit={handleSyncSubmit} className="mt-3.5 flex flex-col gap-2.5 sm:flex-row">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://raw.githubusercontent.com/usuario/repo/main/mpox_uf.csv"
              className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] placeholder-[#64748B] focus:border-[#0052A3] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={customFeedLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0052A3] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#003E7E] disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${customFeedLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{customFeedLoading ? 'Lendo...' : 'Sincronizar URL'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Importar CSV/JSON</span>
              </button>

              {customFeedMeta.kind !== 'reference' && (
                <button
                  type="button"
                  onClick={() => {
                    resetUfData();
                    setUrlInput('');
                    setSyncNotice('Base educativa de referência restaurada.');
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#475569] transition-colors hover:border-[#C81E3A] hover:text-[#C81E3A]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Restaurar padrão</span>
                </button>
              )}
            </div>
          </form>

          {customFeedError && (
            <p className="mt-2.5 text-xs font-medium text-[#C81E3A]">{customFeedError}</p>
          )}
          {syncNotice && !customFeedError && (
            <p className="mt-2.5 text-xs font-medium text-[#047857]">{syncNotice}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2.5 text-[11px] text-[#475569]">
            <span>
              Fonte UF ativa:{' '}
              <strong className="font-semibold text-[#0F172A]">{customFeedMeta.label}</strong> (
              {customFeedMeta.rowCount} UFs)
            </span>
            <span className="font-mono tabular-nums">
              Sincronizado às {formatPtTime(customFeedMeta.updatedAt)}
            </span>
          </div>
        </div>
      )}

      {/* 4 Live KPI Cards */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const stats = card.stats;
          const accentValueClass =
            card.accent === 'crimson'
              ? 'text-[#C81E3A]'
              : card.accent === 'teal'
                ? 'text-[#0E7490]'
                : 'text-[#0052A3]';

          return (
            <div
              key={card.key}
              className="flex flex-col justify-between rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4"
            >
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F172A]">{card.title}</span>
                  <span className="font-mono text-[10px] text-[#64748B] tabular-nums">
                    {stats?.date ? formatPtDate(stats.date) : '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#475569]">{card.subtitle}</p>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`font-mono text-2xl font-bold tabular-nums ${accentValueClass}`}>
                    {loading && !stats
                      ? '...'
                      : stats
                        ? stats.totalCases.toLocaleString('pt-BR')
                        : '—'}
                  </span>
                  <span className="text-[11px] font-medium text-[#475569]">casos</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[#475569] tabular-nums">
                  <span>
                    Óbitos:{' '}
                    <strong className="font-semibold text-[#0F172A]">
                      {stats ? stats.totalDeaths.toLocaleString('pt-BR') : '—'}
                    </strong>
                  </span>
                  <span>
                    Letalidade:{' '}
                    <strong className="font-semibold text-[#0F172A]">
                      {stats ? `${stats.fatalityPct.toFixed(2)}%` : '—'}
                    </strong>
                  </span>
                </div>
              </div>

              {stats && stats.totalCases > 0 && (
                <button
                  type="button"
                  onClick={() => applyCountryToCalc(stats, card.fallbackPop)}
                  className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
                >
                  <Calculator className="h-3 w-3" aria-hidden="true" />
                  <span>Usar na Calculadora</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Monthly Trend SVG Chart + Global Top 6 Ranking */}
      {snapshot && trendPoints.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Monthly Trend Bar Chart */}
          <div className="rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#0F172A]">
                  Evolução Mensal de Novos Casos (Últimos {trendPoints.length} meses · OMS)
                </h3>
                <p className="mt-0.5 font-mono text-[11px] text-[#475569] tabular-nums">
                  {hoveredPoint
                    ? `${hoveredPoint.label}: ${(trendSeries === 'global'
                        ? hoveredPoint.globalNewCases
                        : hoveredPoint.brazilNewCases
                      ).toLocaleString('pt-BR')} novos casos`
                    : 'Passe o cursor sobre as barras para inspecionar cada mês'}
                </p>
              </div>

              <div className="inline-flex rounded-md border border-[#CBD5E1] bg-[#EBF1F6] p-0.5">
                <button
                  type="button"
                  onClick={() => setTrendSeries('global')}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    trendSeries === 'global'
                      ? 'bg-white text-[#0052A3] shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  Mundo
                </button>
                <button
                  type="button"
                  onClick={() => setTrendSeries('brazil')}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    trendSeries === 'brazil'
                      ? 'bg-white text-[#C81E3A] shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  Brasil
                </button>
              </div>
            </div>

            <div className="mt-4">
              <svg
                viewBox="0 0 600 132"
                className="h-32 w-full overflow-visible"
                role="img"
                aria-label="Gráfico mensal de novos casos oficiais da OMS"
              >
                {/* Horizontal crisp clinical grid lines */}
                {[0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = 108 - frac * 96;
                  return (
                    <line
                      key={frac}
                      x1={0}
                      y1={y}
                      x2={600}
                      y2={y}
                      stroke="#CBD5E1"
                      strokeDasharray="3 4"
                      strokeWidth={1}
                    />
                  );
                })}
                <line x1={0} y1={108} x2={600} y2={108} stroke="#94A3B8" strokeWidth={1.2} />

                {trendPoints.map((pt, idx) => {
                  const val = trendSeries === 'global' ? pt.globalNewCases : pt.brazilNewCases;
                  const slotW = 600 / trendPoints.length;
                  const barW = Math.max(8, slotW - 8);
                  const barH = Math.max(2, (val / maxTrendVal) * 94);
                  const x = idx * slotW + (slotW - barW) / 2;
                  const y = 108 - barH;
                  const isHovered = hoveredBarIdx === idx;
                  const fill =
                    trendSeries === 'global'
                      ? isHovered
                        ? '#003E7E'
                        : '#0052A3'
                      : isHovered
                        ? '#991B1B'
                        : '#C81E3A';

                  const showTick = idx === 0 || idx === trendPoints.length - 1 || idx % 3 === 0;

                  return (
                    <g
                      key={pt.month}
                      onMouseEnter={() => setHoveredBarIdx(idx)}
                      onMouseLeave={() => setHoveredBarIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={idx * slotW}
                        y={8}
                        width={slotW}
                        height={102}
                        fill="transparent"
                      />
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx={2}
                        fill={fill}
                        opacity={hoveredBarIdx === null || isHovered ? 0.96 : 0.42}
                      />
                      {showTick && (
                        <text
                          x={idx * slotW + slotW / 2}
                          y={124}
                          textAnchor="middle"
                          fill="#475569"
                          fontSize="10"
                          fontFamily="ui-monospace, SFMono-Regular, monospace"
                        >
                          {pt.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Top 6 Countries Official Table */}
          <div className="rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[#0F172A]">
                Maiores Acumulados Globais (OMS)
              </h3>
              <a
                href="https://ourworldindata.org/mpox"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0052A3] hover:underline"
              >
                <span>OWID/OMS</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-3 divide-y divide-[#E2E8F0]">
              {snapshot.topCountries.slice(0, 6).map((c, idx) => {
                const isBrazil = c.location === 'Brazil';
                return (
                  <div
                    key={c.location}
                    className={`flex items-center justify-between gap-2 py-2 text-xs ${
                      isBrazil ? 'text-[#0052A3]' : 'text-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 font-mono text-[10px] font-semibold text-[#64748B] tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className={`truncate ${isBrazil ? 'font-bold' : 'font-medium'}`}>
                        {translateCountry(c.location)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums shrink-0">
                      <span className="font-bold text-[#0F172A]">
                        {c.totalCases.toLocaleString('pt-BR')}
                      </span>
                      <span className="w-12 text-right text-[#475569]">
                        {c.fatalityPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
