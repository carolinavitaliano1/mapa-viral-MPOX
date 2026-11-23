import React, { useMemo, useRef, useState } from 'react';
import { Calculator, Check, Code2, Copy, GraduationCap } from 'lucide-react';
import {
  CLADE_COMPARISON,
  PYTHON_SCRIPT_CONTENT,
  R_SCRIPT_CONTENT,
} from '../data/mpoxTimeline';
import { LiveMpoxController } from '../hooks/useLiveMpoxData';
import { ClassroomPostDraft } from '../utils/googleClassroomApi';
import { LiveSurveillancePanel } from './LiveSurveillancePanel';

interface BiostatisticsViewProps {
  liveData: LiveMpoxController;
  onOpenGithubModal: () => void;
  onShareToClassroom?: (draft: ClassroomPostDraft) => void;
}

interface CalcPreset {
  label: string;
  cases: number;
  population: number;
  deaths: number;
}

export const BiostatisticsView: React.FC<BiostatisticsViewProps> = ({
  liveData,
  onOpenGithubModal,
  onShareToClassroom,
}) => {
  const { ufNodes, customFeedMeta, snapshot } = liveData;
  const [selectedUf, setSelectedUf] = useState<string>('SP');
  const [scriptLang, setScriptLang] = useState<'r' | 'python'>('r');
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeCalcSource, setActiveCalcSource] = useState<string>('São Paulo');
  const calcRef = useRef<HTMLDivElement | null>(null);

  // Interactive epidemiological calculator state
  const [cases, setCases] = useState<number>(4120);
  const [population, setPopulation] = useState<number>(44411238);
  const [deaths, setDeaths] = useState<number>(6);

  const selectedStateNode =
    ufNodes.find((n) => n.uf === selectedUf) ?? ufNodes[0];

  const calcPresets = useMemo<CalcPreset[]>(() => {
    const topFromUf: CalcPreset[] = ufNodes.slice(0, 3).map((n) => ({
      label: `${n.name} (${n.uf})`,
      cases: n.cases,
      population: n.population,
      deaths: n.deaths,
    }));
    if (snapshot?.brazil && snapshot.brazil.totalCases > 0) {
      topFromUf.push({
        label: 'Brasil (OMS ao vivo)',
        cases: snapshot.brazil.totalCases,
        population: snapshot.brazil.estimatedPopulation ?? 212_600_000,
        deaths: snapshot.brazil.totalDeaths,
      });
    } else {
      topFromUf.push({
        label: 'Cenário Municipal (UBS)',
        cases: 38,
        population: 250000,
        deaths: 0,
      });
    }
    return topFromUf;
  }, [ufNodes, snapshot]);

  const maxUfShare = useMemo(
    () => Math.max(10, ...ufNodes.map((n) => n.sharePercent)),
    [ufNodes]
  );

  const handleApplyLiveToCalculator = (payload: {
    label: string;
    cases: number;
    population: number;
    deaths: number;
  }) => {
    setCases(payload.cases);
    setPopulation(payload.population);
    setDeaths(payload.deaths);
    setActiveCalcSource(`${payload.label} · OMS ao vivo`);
    calcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const metrics = useMemo(() => {
    const safeCases = Math.max(0, Number.isFinite(cases) ? cases : 0);
    const safePop = Math.max(1, Number.isFinite(population) ? population : 1);
    const safeDeaths = Math.min(safeCases, Math.max(0, Number.isFinite(deaths) ? deaths : 0));

    const incidencePer100k = (safeCases / safePop) * 100_000;
    const fatalityPct = safeCases > 0 ? (safeDeaths / safeCases) * 100 : 0;

    // 95% Wilson CI for Case Fatality Rate
    let ciLow = 0;
    let ciHigh = 0;
    if (safeCases > 0) {
      const z = 1.96;
      const p = safeDeaths / safeCases;
      const denom = 1 + (z * z) / safeCases;
      const center = (p + (z * z) / (2 * safeCases)) / denom;
      const margin =
        (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * safeCases)) / safeCases)) / denom;
      ciLow = Math.max(0, (center - margin) * 100);
      ciHigh = Math.min(100, (center + margin) * 100);
    }

    return {
      incidencePer100k,
      fatalityPct,
      ciLow,
      ciHigh,
    };
  }, [cases, population, deaths]);

  const activeCode = scriptLang === 'r' ? R_SCRIPT_CONTENT : PYTHON_SCRIPT_CONTENT;

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // Ignore if clipboard API blocked
    }
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:py-12">
      {/* Header */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold text-[#0052A3]">
          Dados & Bioestatística · Extensão Universitária em Farmácia
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          Vigilância Epidemiológica, Indicadores e Scripts Reprodutíveis
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#334155]">
          Ferramentas quantitativas aplicadas ao monitoramento da Mpox no Brasil (SINAN/SUS),
          comparativo entre clados virais e código aberto em R e Python para formação em Saúde
          Pública.
        </p>
      </header>

      {/* Row 0: Live Official WHO/OWID Surveillance + GitHub/CSV Repository Sync */}
      <LiveSurveillancePanel
        liveData={liveData}
        onApplyToCalculator={handleApplyLiveToCalculator}
      />

      {/* Row 1: Brazil State Concentration Chart + Interactive Biostatistics Calculator */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Interactive State Concentration Chart */}
        <div className="flex flex-col justify-between rounded-xl border border-[#CBD5E1] bg-white p-6 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-[#0F172A]">
                Concentração Proporcional por UF no Brasil
              </h2>
              <span className="font-mono text-xs text-[#475569]">
                {customFeedMeta.kind === 'reference'
                  ? 'Base educativa · Ordem de concentração SUS'
                  : `Sincronizado · ${customFeedMeta.label}`}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[#475569]">
              {customFeedMeta.kind === 'reference'
                ? 'No cenário nacional de vigilância, os registros concentram-se em São Paulo, seguidos por Rio de Janeiro e Rondônia, e depois Minas Gerais, Rio Grande do Sul, Distrito Federal e Paraná. Selecione uma UF para inspecionar ou sincronize seu repositório acima.'
                : 'Distribuição atualizada dinamicamente a partir da fonte conectada. Clique em qualquer UF para inspecionar os números e enviar para a calculadora.'}
            </p>

            {/* Clean interactive horizontal bar chart */}
            <div className="mt-6 space-y-2.5" role="list" aria-label="Distribuição por estado">
              {ufNodes.map((node, idx) => {
                const isSelected = node.uf === selectedStateNode?.uf;
                const barWidthPct = (node.sharePercent / maxUfShare) * 100;
                const barColor =
                  idx === 0
                    ? 'bg-[#C81E3A]'
                    : idx <= 2
                      ? 'bg-[#D97706]'
                      : 'bg-[#0052A3]';

                return (
                  <button
                    key={node.uf}
                    type="button"
                    onClick={() => {
                      setSelectedUf(node.uf);
                      setCases(node.cases);
                      setPopulation(node.population);
                      setDeaths(node.deaths);
                      setActiveCalcSource(`${node.name} (${node.uf})`);
                    }}
                    className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#0052A3] bg-[#E6F0FA]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#94A3B8] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <span className="w-8 font-mono text-xs font-bold text-[#0F172A] tabular-nums">
                      {node.uf}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#1E293B]">{node.name}</span>
                        <span className="font-mono font-medium text-[#334155] tabular-nums">
                          {node.cases.toLocaleString('pt-BR')} casos · {node.sharePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-[#DDE6EF]">
                        <div
                          className={`h-full rounded-sm transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.min(100, barWidthPct)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedStateNode && (
            <div className="mt-5 rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                <span className="font-mono font-bold text-[#0052A3]">
                  {selectedStateNode.uf} · {selectedStateNode.name}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-medium tabular-nums">
                  {selectedStateNode.cases.toLocaleString('pt-BR')} casos ({selectedStateNode.sharePercent.toFixed(1)}%)
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#334155]">
                {selectedStateNode.role}
              </p>
            </div>
          )}
        </div>

        {/* Interactive Biostatistics Calculator */}
        <div
          ref={calcRef}
          className="flex flex-col justify-between rounded-xl border border-[#CBD5E1] bg-white p-6 lg:col-span-5"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
                <h2 className="font-display text-lg font-semibold text-[#0F172A]">
                  Calculadora Epidemiológica
                </h2>
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#0E7490]">
                {activeCalcSource}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[#475569]">
              Simule indicadores clássicos de vigilância em Saúde Pública com intervalo de confiança
              de Wilson (95%).
            </p>

            {/* Quick scenario buttons */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {calcPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setCases(preset.cases);
                    setPopulation(preset.population);
                    setDeaths(preset.deaths);
                    setActiveCalcSource(preset.label);
                  }}
                  className="rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-medium text-[#1E293B] transition-colors hover:border-[#0052A3] hover:bg-[#E6F0FA] hover:text-[#0052A3]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Numeric inputs */}
            <div className="mt-5 space-y-3.5">
              <div>
                <label htmlFor="calc-cases" className="block text-xs font-semibold text-[#1E293B]">
                  Casos confirmados (n)
                </label>
                <input
                  id="calc-cases"
                  type="number"
                  min={0}
                  value={cases}
                  onChange={(e) => setCases(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-sm font-medium text-[#0F172A] tabular-nums focus:border-[#0052A3] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="calc-pop" className="block text-xs font-semibold text-[#1E293B]">
                  População sob risco (habitantes)
                </label>
                <input
                  id="calc-pop"
                  type="number"
                  min={1}
                  value={population}
                  onChange={(e) => setPopulation(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-sm font-medium text-[#0F172A] tabular-nums focus:border-[#0052A3] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="calc-deaths" className="block text-xs font-semibold text-[#1E293B]">
                  Óbitos atribuídos
                </label>
                <input
                  id="calc-deaths"
                  type="number"
                  min={0}
                  max={cases}
                  value={deaths}
                  onChange={(e) => setDeaths(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-sm font-medium text-[#0F172A] tabular-nums focus:border-[#0052A3] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Computed Metric Readouts */}
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[#E2E8F0] pt-5 sm:grid-cols-2">
            <div className="rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-3.5">
              <div className="text-xs font-medium text-[#475569]">Taxa de incidência</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-[#0052A3] tabular-nums">
                  {metrics.incidencePer100k.toFixed(2)}
                </span>
                <span className="font-mono text-[11px] text-[#475569]">/ 100 mil</span>
              </div>
            </div>

            <div className="rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-3.5">
              <div className="text-xs font-medium text-[#475569]">Letalidade (IC 95%)</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-[#C81E3A] tabular-nums">
                  {metrics.fatalityPct.toFixed(2)}%
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-[#475569] tabular-nums">
                [{metrics.ciLow.toFixed(2)}% – {metrics.ciHigh.toFixed(2)}%]
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Clado 1 vs Clado 2 Scientific Comparison Matrix */}
      <section className="mt-10 rounded-xl border border-[#CBD5E1] bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[#0F172A]">
            Comparativo Virológico e Epidemiológico: Clado 1 vs. Clado 2
          </h2>
          <span className="text-xs text-[#475569]">
            Referências: OMS · Ministério da Saúde · Fiocruz
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[#CBD5E1] text-xs font-bold text-[#475569]">
                <th className="py-3 pr-4">Critério de vigilância</th>
                <th className="px-4 py-3 text-[#B91C1C]">Clado 1 (Subclados 1a / 1b)</th>
                <th className="pl-4 py-3 text-[#0052A3]">Clado 2 (Subclados 2a / 2b)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {CLADE_COMPARISON.map((row) => (
                <tr key={row.criterion} className="align-top">
                  <td className="py-3.5 pr-4 font-semibold text-[#0F172A]">{row.criterion}</td>
                  <td className="px-4 py-3.5 leading-relaxed text-[#334155]">{row.clade1}</td>
                  <td className="pl-4 py-3.5 leading-relaxed text-[#334155]">{row.clade2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 3: Reproducible Open-Science Scripts (R & Python) */}
      <section className="mt-10 rounded-xl border border-[#CBD5E1] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#0F172A]">
              Scripts Reprodutíveis em R e Python
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              Código didático pronto para análise de bases do SINAN/e-SUS em aulas práticas de
              Bioestatística e Epidemiologia Farmacêutica.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented functional filter tabs */}
            <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => setScriptLang('r')}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                  scriptLang === 'r'
                    ? 'bg-white text-[#0052A3] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                R (tidyverse · epiR)
              </button>
              <button
                type="button"
                onClick={() => setScriptLang('python')}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                  scriptLang === 'python'
                    ? 'bg-white text-[#0052A3] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                Python (pandas · scipy)
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyScript}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
            >
              {copiedScript ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#047857]" aria-hidden="true" />
                  <span>Script copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copiar script</span>
                </>
              )}
            </button>

            {onShareToClassroom && (
              <button
                type="button"
                onClick={() =>
                  onShareToClassroom({
                    kind: 'material',
                    title:
                      scriptLang === 'r'
                        ? 'Material Prático: Script de Bioestatística Mpox em R (tidyverse · epiR)'
                        : 'Material Prático: Script de Bioestatística Mpox em Python (pandas · scipy)',
                    description:
                      `Roteiro reprodutível para análise epidemiológica da Mpox (${
                        scriptLang === 'r' ? 'Linguagem R' : 'Python 3'
                      }) — cálculo de incidência por 100 mil hab., taxa de letalidade com IC 95% (Wilson) e visualização por UF:\n\n` +
                      activeCode,
                    topicName: '3. Bioestatística em Saúde Pública',
                    sourceBadge: `Bioestatística · ${scriptLang === 'r' ? 'Script R' : 'Script Python'}`,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#99F6E4] bg-[#F0FDFA] px-3 py-2 text-xs font-semibold text-[#0F766E] transition-colors hover:bg-[#0F766E] hover:text-white"
              >
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Publicar no Classroom</span>
              </button>
            )}
          </div>
        </div>

        <pre className="mt-5 overflow-x-auto rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4 font-mono text-xs leading-relaxed text-[#0F172A]">
          <code>{activeCode}</code>
        </pre>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569]">
          <span>
            Nota metodológica: números de referência ilustrativos para treinamento em ciência de
            dados em saúde; consulte os painéis oficiais do Ministério da Saúde para séries
            atualizadas.
          </span>
          <button
            type="button"
            onClick={onOpenGithubModal}
            className="inline-flex items-center gap-1.5 font-semibold text-[#0052A3] hover:underline"
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Configurar repositório GitHub</span>
          </button>
        </div>
      </section>
    </main>
  );
};
