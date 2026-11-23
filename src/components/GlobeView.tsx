import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cloud,
  Compass,
  Globe2,
  GraduationCap,
  Info,
  Pause,
  Play,
  RefreshCw,
  Tag,
  X,
} from 'lucide-react';
import { MPOX_STEPS } from '../data/mpoxTimeline';
import { LiveMpoxController } from '../hooks/useLiveMpoxData';
import { CountryLiveStats } from '../types/liveMpox';
import { GlobeSurfaceTheme, MpoxGlobe } from '../three/MpoxGlobe';
import { ClassroomPostDraft } from '../utils/googleClassroomApi';

interface GlobeViewProps {
  liveData: LiveMpoxController;
  onShareToClassroom?: (draft: ClassroomPostDraft) => void;
}

function getLiveStatsForStep(
  stepId: number,
  liveData: LiveMpoxController
): { label: string; stats: CountryLiveStats } | null {
  const snap = liveData.snapshot;
  if (!snap) return null;
  if (stepId === 1 && snap.countries['Denmark']) {
    return { label: 'Dinamarca · Série atual OMS', stats: snap.countries['Denmark'] };
  }
  if ((stepId === 2 || stepId === 7) && snap.countries['Democratic Republic of Congo']) {
    return {
      label: 'Rep. Dem. do Congo · Série atual OMS',
      stats: snap.countries['Democratic Republic of Congo'],
    };
  }
  if (stepId === 3 && snap.countries['United States']) {
    return { label: 'Estados Unidos · Série atual OMS', stats: snap.countries['United States'] };
  }
  if (stepId === 4) {
    return { label: 'Acumulado Global · Série atual OMS', stats: snap.global };
  }
  if (stepId === 5 || stepId === 6 || stepId === 8) {
    return { label: 'Brasil · Série atual OMS', stats: snap.brazil };
  }
  return null;
}

function formatIsoToBrDate(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export const GlobeView: React.FC<GlobeViewProps> = ({ liveData, onShareToClassroom }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  // Interactive 3D layer toggles
  const [showClouds, setShowClouds] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showBrazilColumns, setShowBrazilColumns] = useState(false);
  const [surfaceTheme, setSurfaceTheme] = useState<GlobeSurfaceTheme>('realistic');

  const activeStep = MPOX_STEPS[activeIndex];
  const progressPct = ((activeIndex + 1) / MPOX_STEPS.length) * 100;
  const brazilColumnsEngaged = showBrazilColumns || activeIndex === 7;

  const goToStep = (nextIdx: number) => {
    const clamped = (nextIdx + MPOX_STEPS.length) % MPOX_STEPS.length;
    setActiveIndex(clamped);
    setFocusTrigger((n) => n + 1);
    setPanelOpen(true);
  };

  const handlePrev = () => {
    setAutoPlay(false);
    goToStep(activeIndex - 1);
  };

  const handleNext = () => {
    setAutoPlay(false);
    goToStep(activeIndex + 1);
  };

  const handleRecenter = () => {
    setFocusTrigger((n) => n + 1);
  };

  const handleToggleBrazilColumns = () => {
    if (activeIndex === 7 && !showBrazilColumns) {
      setShowBrazilColumns(true);
      return;
    }
    const next = !showBrazilColumns;
    setShowBrazilColumns(next);
    if (next && activeIndex < 4) {
      setAutoPlay(false);
      goToStep(7);
    }
  };

  // Auto-tour timer
  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % MPOX_STEPS.length);
      setFocusTrigger((n) => n + 1);
    }, 6500);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  // Keyboard navigation (ArrowLeft, ArrowRight, H to hide/show HUD)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'ArrowRight') {
        setAutoPlay(false);
        setActiveIndex((prev) => (prev + 1) % MPOX_STEPS.length);
        setFocusTrigger((n) => n + 1);
      } else if (e.key === 'ArrowLeft') {
        setAutoPlay(false);
        setActiveIndex((prev) => (prev - 1 + MPOX_STEPS.length) % MPOX_STEPS.length);
        setFocusTrigger((n) => n + 1);
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => {
          const next = !prev;
          if (next) setPanelOpen(false);
          else setPanelOpen(true);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const formatCoord = (val: number, pos: string, neg: string) =>
    `${Math.abs(val).toFixed(2)}°${val >= 0 ? pos : neg}`;

  return (
    <section
      className="relative h-[calc(100vh-56px)] min-h-[600px] w-full overflow-hidden bg-[#E9F1F7]"
      aria-label="Mapa 3D interativo da história da Mpox"
    >
      {/* Full-bleed 3D WebGL Globe */}
      <MpoxGlobe
        activeStepIndex={activeIndex}
        onSelectStep={(idx) => {
          setAutoPlay(false);
          goToStep(idx);
        }}
        focusTrigger={focusTrigger}
        panelOpen={panelOpen}
        showClouds={showClouds}
        showLabels={showLabels}
        showBrazilColumns={showBrazilColumns}
        surfaceTheme={surfaceTheme}
        brazilNodes={liveData.ufNodes}
      />

      {/* Top-Left Minimal Context Readout */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 sm:left-6 sm:top-5">
        <div className="pointer-events-auto rounded-lg border border-[#CBD5E1] bg-white/95 px-3.5 py-2.5 shadow-md">
          <p className="text-[11px] font-semibold text-[#0052A3]">
            Projeto de Extensão em Farmácia · Saúde Pública e Epidemiologia
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold text-[#0F172A]">
            <span>História da Mpox (1958–2025)</span>
            <span className="text-[#94A3B8]" aria-hidden="true">·</span>
            <span className="font-mono text-xs font-semibold text-[#0E7490] tabular-nums">
              {formatCoord(activeStep.lat, 'N', 'S')}, {formatCoord(activeStep.lng, 'L', 'O')}
            </span>
          </div>
        </div>
      </div>

      {/* Reopen Step Card Button when collapsed */}
      {!panelOpen && !dockCollapsed && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white/95 px-3.5 py-2 text-xs font-semibold text-[#0F172A] shadow-md transition-colors hover:border-[#0052A3] hover:text-[#0052A3] sm:right-6 sm:top-5"
        >
          <Info className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
          <span>Detalhes do Passo {activeStep.id}</span>
        </button>
      )}

      {/* Collapsible Side Narrative Panel */}
      {panelOpen && !dockCollapsed && (
        <aside
          className="absolute right-4 top-20 z-20 max-h-[calc(100%-190px)] w-[372px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-[#CBD5E1] bg-white/96 p-5 shadow-xl sm:right-6 sm:top-5 sm:max-h-[calc(100%-162px)]"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569]">
              <span className="font-mono font-bold text-[#0052A3] tabular-nums">
                Passo {activeStep.id} / {MPOX_STEPS.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[#1E293B] tabular-nums">
                {activeStep.yearLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              aria-label="Minimizar painel do passo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mt-2 text-xs font-semibold text-[#C81E3A]">
                {activeStep.publicHealthTag}
              </p>

              <h2 className="mt-1 font-display text-xl font-bold leading-snug text-[#0F172A]">
                {activeStep.title}
              </h2>

              <p className="mt-1 text-xs font-medium text-[#475569]">
                {activeStep.location} · {activeStep.clade}
              </p>

              <div className="my-3.5 h-px w-full bg-[#E2E8F0]" />

              <p className="text-[14px] leading-relaxed text-[#1E293B]">
                {activeStep.summary}
              </p>

              <div className="mt-4 rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-3.5">
                <p className="text-xs font-bold text-[#0052A3]">
                  Destaque em Saúde Pública
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#334155]">
                  {activeStep.keyHighlight}
                </p>
              </div>

              {(() => {
                const liveMatch = getLiveStatsForStep(activeStep.id, liveData);
                if (!liveMatch) return null;
                return (
                  <div className="mt-3.5 rounded-lg border border-[#BFD7EE] bg-[#F0F7FD] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#0052A3]">
                        {liveMatch.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => liveData.refreshNow()}
                        disabled={liveData.refreshing}
                        title="Atualizar dados oficiais OMS agora"
                        className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#475569] transition-colors hover:text-[#0052A3] disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${liveData.refreshing ? 'animate-spin text-[#0052A3]' : ''}`}
                          aria-hidden="true"
                        />
                        <span>{formatIsoToBrDate(liveMatch.stats.date)}</span>
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums">
                      <div>
                        <div className="text-[10px] text-[#475569]">Casos</div>
                        <div className="font-bold text-[#0F172A]">
                          {liveMatch.stats.totalCases.toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#475569]">Óbitos</div>
                        <div className="font-bold text-[#C81E3A]">
                          {liveMatch.stats.totalDeaths.toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#475569]">Letalidade</div>
                        <div className="font-bold text-[#B45309]">
                          {liveMatch.stats.fatalityPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeStep.id === 8 && (
                <div className="mt-4 rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#0F172A]">
                      Colunas 3D · Concentração no Brasil
                    </p>
                    <span className="font-mono text-[10px] font-medium text-[#475569]">
                      {liveData.customFeedMeta.kind === 'reference'
                        ? 'Referência SUS'
                        : 'Repositório ativo'}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-7 gap-1 text-center font-mono text-[11px] tabular-nums">
                    {liveData.ufNodes.slice(0, 7).map((node, i) => (
                      <div
                        key={node.uf}
                        className={`rounded border px-1 py-1.5 ${
                          i === 0
                            ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                            : i <= 2
                              ? 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]'
                              : 'border-[#CBD5E1] bg-white text-[#1E293B]'
                        }`}
                      >
                        <div className="font-bold">{node.uf}</div>
                        <div className="mt-0.5 text-[10px] opacity-90">
                          {node.sharePercent.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3 text-xs text-[#475569]">
                <span>Fonte: {activeStep.source}</span>
                <div className="flex items-center gap-2">
                  {onShareToClassroom && (
                    <button
                      type="button"
                      onClick={() =>
                        onShareToClassroom({
                          kind: 'assignment',
                          title: `Estudo de Caso (${activeStep.yearLabel}): ${activeStep.title}`,
                          description:
                            `Marco Histórico ${activeStep.id}/${MPOX_STEPS.length} — ${activeStep.location} (${activeStep.yearLabel})\n` +
                            `Clado / Linhagem: ${activeStep.clade}\n\n` +
                            `Contexto Epidemiológico:\n${activeStep.summary}\n\n` +
                            `Destaque em Saúde Pública:\n${activeStep.keyHighlight}\n\n` +
                            `Questões para o Estudante de Farmácia:\n` +
                            `1. Analise no Globo 3D a rota geográfica e o contexto de transmissão deste marco (${activeStep.location}).\n` +
                            `2. Quais implicações de vigilância epidemiológica, diagnóstico laboratorial (qPCR) e assistência farmacêutica este evento traz para o SUS?`,
                          maxPoints: 100,
                          topicName: '2. Epidemiologia Histórica e Clados',
                          sourceBadge: `Globo 3D · Marco ${activeStep.shortYear}`,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-2 py-1 text-[11px] font-semibold text-[#0F766E] transition-colors hover:bg-[#0F766E] hover:text-white"
                      title="Publicar estudo de caso deste marco histórico no Google Classroom"
                    >
                      <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Criar Atividade</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRecenter}
                    className="inline-flex items-center gap-1 font-semibold text-[#0052A3] transition-colors hover:text-[#003E7E]"
                  >
                    <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Focar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </aside>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center px-3 sm:bottom-4">
        <button
          type="button"
          onClick={() => {
            setDockCollapsed((prev) => {
              const next = !prev;
              if (next) setPanelOpen(false);
              else setPanelOpen(true);
              return next;
            });
          }}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[#CBD5E1] bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#334155] shadow-xs transition-colors hover:text-[#0052A3]"
          aria-expanded={!dockCollapsed}
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Mostrar controles (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ocultar painéis (H)</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[940px] rounded-xl border border-[#CBD5E1] bg-white/96 px-3.5 py-3 shadow-xl sm:px-5">
            {/* Step progress bar & clickable markers */}
            <div className="mb-2.5">
              <div className="flex items-center justify-between text-[11px] text-[#475569]">
                <span className="font-semibold text-[#1E293B]">Linha do Tempo Interativa</span>
                <span className="font-mono font-semibold tabular-nums text-[#0052A3]">
                  {activeIndex + 1} / {MPOX_STEPS.length} · {Math.round(progressPct)}%
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-8 gap-1.5">
                {MPOX_STEPS.map((step, idx) => {
                  const isActive = idx === activeIndex;
                  const isVisited = idx < activeIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        setAutoPlay(false);
                        goToStep(idx);
                      }}
                      title={`Passo ${step.id}: ${step.yearLabel} — ${step.location}`}
                      className="group flex flex-col items-start text-left focus-visible:outline-none"
                    >
                      <span
                        className={`h-1.5 w-full rounded-sm transition-colors ${
                          isActive
                            ? step.pinTone === 'coral'
                              ? 'bg-[#C81E3A]'
                              : 'bg-[#0052A3]'
                            : isVisited
                              ? 'bg-[#0052A3]/55 group-hover:bg-[#0052A3]/85'
                              : 'bg-[#CBD5E1] group-hover:bg-[#94A3B8]'
                        }`}
                      />
                      <span
                        className={`mt-1 hidden font-mono text-[10px] tabular-nums sm:block truncate w-full ${
                          isActive
                            ? 'font-bold text-[#0F172A]'
                            : 'text-[#64748B] group-hover:text-[#0F172A]'
                        }`}
                      >
                        {step.shortYear}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom action row: Step buttons + 3D Layers + Camera controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-xs font-semibold text-[#1E293B] whitespace-nowrap transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0052A3] px-4 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#003E7E]"
                >
                  <span>Próximo</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowLabels((v) => !v)}
                  aria-pressed={showLabels}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    showLabels
                      ? 'border-[#0052A3] bg-[#E6F0FA] text-[#0052A3]'
                      : 'border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Rótulos 3D</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSurfaceTheme((t) => (t === 'realistic' ? 'scientific' : 'realistic'))
                  }
                  aria-pressed={surfaceTheme === 'realistic'}
                  title="Alternar entre Terra colorida realista e mapa cartográfico técnico"
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    surfaceTheme === 'realistic'
                      ? 'border-[#0052A3] bg-[#E6F0FA] text-[#0052A3]'
                      : 'border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">
                    {surfaceTheme === 'realistic' ? 'Terra Realista' : 'Mapa Técnico'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClouds((v) => !v)}
                  aria-pressed={showClouds}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    showClouds
                      ? 'border-[#0052A3] bg-[#E6F0FA] text-[#0052A3]'
                      : 'border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Nuvens 3D</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleBrazilColumns}
                  aria-pressed={brazilColumnsEngaged}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    brazilColumnsEngaged
                      ? 'border-[#B45309] bg-[#FFFBEB] text-[#92400E]'
                      : 'border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Colunas Brasil</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoPlay((p) => !p)}
                  aria-pressed={autoPlay}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    autoPlay
                      ? 'border-[#C81E3A] bg-[#FEF2F2] text-[#991B1B]'
                      : 'border-[#CBD5E1] bg-white text-[#334155] hover:border-[#0052A3] hover:text-[#0052A3]'
                  }`}
                >
                  {autoPlay ? (
                    <>
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden lg:inline">Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden lg:inline">Tour</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRecenter}
                  title="Centralizar câmera no marco atual"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#334155] whitespace-nowrap transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden xl:inline">Centralizar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
