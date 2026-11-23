import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  EyeOff,
  FlaskConical,
  GraduationCap,
  Info,
  Layers,
  Maximize2,
  Menu,
  RefreshCw,
  RotateCcw,
  Scissors,
  Tag,
} from 'lucide-react';
import { VIRUS_STRUCTURES, VirusPartId } from '../data/virusAnatomy';
import { MpoxVirusScene } from '../three/MpoxVirusScene';
import { VirusCutMode } from '../three/virusGeometry';
import { ClassroomPostDraft } from '../utils/googleClassroomApi';

interface VirusViewProps {
  onShareToClassroom?: (draft: ClassroomPostDraft) => void;
}

const ALL_VISIBLE: Record<VirusPartId, boolean> = {
  outer_membrane: true,
  surface_tubules: true,
  inner_membrane: true,
  lateral_bodies: true,
  palisade_layer: true,
  biconcave_core: true,
  dna_genome: true,
};

export const VirusView: React.FC<VirusViewProps> = ({ onShareToClassroom }) => {
  const [selectedId, setSelectedId] = useState<VirusPartId | null>(null);
  const [visibility, setVisibility] = useState<Record<VirusPartId, boolean>>(ALL_VISIBLE);
  const [explodePct, setExplodePct] = useState<number>(0);
  const [cutMode, setCutMode] = useState<VirusCutMode>('quarter');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);
  const [focusTrigger, setFocusTrigger] = useState<number>(0);

  const [leftOpen, setLeftOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const detailsSectionRef = useRef<HTMLElement | null>(null);

  const selected = VIRUS_STRUCTURES.find((s) => s.id === selectedId) ?? null;

  const handleSelectStructure = (id: VirusPartId | null) => {
    setSelectedId(id);
    setFocusTrigger((n) => n + 1);
    if (id) {
      setVisibility((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
      setDetailsOpen(true);
    }
  };

  const handleToggleLayer = (id: VirusPartId, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibility((prev) => {
      const nextVal = !prev[id];
      if (!nextVal && selectedId === id) {
        setSelectedId(null);
      }
      return { ...prev, [id]: nextVal };
    });
  };

  const handleShowAll = () => {
    setVisibility(ALL_VISIBLE);
  };

  const handleViewInner = () => {
    const next = { ...ALL_VISIBLE };
    for (const s of VIRUS_STRUCTURES) {
      next[s.id] = !s.isOuter;
      if (s.isOuter && selectedId === s.id) {
        setSelectedId(null);
      }
    }
    setVisibility(next);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'h' || e.key === 'H') {
        const anyOpen = leftOpen || detailsOpen;
        setLeftOpen(!anyOpen);
        setDetailsOpen(!anyOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leftOpen, detailsOpen]);

  return (
    <section
      className="flex min-h-[calc(100vh-56px)] w-full flex-col bg-[#EEF4F9] text-[#0F172A]"
      aria-label="Visualizador 3D interativo do vírus Mpox em corte transversal"
    >
      {/* Unobstructed 3D Interactive Stage */}
      <div
        className={`relative w-full overflow-hidden select-none transition-[height] duration-300 ${
          detailsOpen
            ? 'h-[56vh] min-h-[420px] max-h-[620px]'
            : 'h-[calc(100vh-56px)] min-h-[580px]'
        }`}
      >
        {/* Full-Bleed Scientific 3D Virus Canvas + Floating 3D Labels + Hover Tooltip */}
        <MpoxVirusScene
          selectedId={selectedId}
          onSelectStructure={(id) => handleSelectStructure(id)}
          visibility={visibility}
          explodeTarget={explodePct / 100}
          cutMode={cutMode}
          autoRotate={autoRotate}
          showLabels={showLabels}
          cameraResetTrigger={cameraResetTrigger}
          focusTrigger={focusTrigger}
        />

        {/* Top Scientific Header Bar */}
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-3">
          {/* Reopen Left Panel Button */}
          {!leftOpen ? (
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              title="Abrir painel de camadas"
              className="pointer-events-auto flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white/95 px-3 py-2.5 text-xs font-semibold text-[#0F172A] shadow-md transition hover:border-[#0052A3] hover:bg-[#F0F7FD]"
            >
              <Menu className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
              <span className="hidden sm:inline">Camadas</span>
            </button>
          ) : (
            <div className="w-0 sm:w-10" />
          )}

          {/* Centered Scientific Title Card */}
          <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl border border-[#CBD5E1] bg-white/95 px-4 py-2.5 text-center shadow-lg sm:px-6">
            <h1 className="text-sm font-bold tracking-tight text-[#0F172A] sm:text-base md:text-lg">
              Vírus Mpox (MPXV) — Corte Transversal 3D
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-[#475569] sm:text-xs">
              Orthopoxvirus • DNA fita dupla (~197 kb) • Escala proporcional: ~300 × 200 × 170 nm
            </p>
          </div>

          {/* Toggle Bottom Ficha Estrutural Button */}
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            aria-expanded={detailsOpen}
            title={detailsOpen ? 'Recolher ficha estrutural' : 'Mostrar ficha estrutural abaixo do modelo'}
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-md transition ${
              detailsOpen
                ? 'border-[#0052A3] bg-[#0052A3] text-white hover:bg-[#003E7E]'
                : 'border-[#CBD5E1] bg-white/95 text-[#0F172A] hover:border-[#0052A3] hover:bg-[#F0F7FD]'
            }`}
          >
            <Info
              className={`h-4 w-4 ${detailsOpen ? 'text-white' : 'text-[#0E7490]'}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Ficha Estrutural</span>
            {detailsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Left Collapsible Panel: Camadas Anatômicas, Corte, Vista Explodida & Controles */}
        <aside
          aria-label="Camadas Anatômicas e Controles"
          className={`absolute bottom-3 left-3 top-[78px] z-20 flex w-[285px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white/96 shadow-xl transition-all duration-300 sm:w-[304px] ${
            leftOpen
              ? 'translate-x-0 opacity-100 pointer-events-auto'
              : '-translate-x-[120%] opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                Camadas Anatômicas
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setLeftOpen(false)}
              title="Recolher painel de camadas"
              className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-[#E2E8F0] hover:text-[#0F172A]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
            {/* Quick Layer Visibility Presets */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShowAll}
                className="rounded-xl border border-[#0052A3]/30 bg-[#E6F0FA] px-2.5 py-2 text-xs font-semibold text-[#0052A3] transition hover:bg-[#D4E6F8]"
              >
                Mostrar Todas
              </button>
              <button
                type="button"
                onClick={handleViewInner}
                className="rounded-xl border border-[#0E7490]/30 bg-[#ECFEFF] px-2.5 py-2 text-xs font-semibold text-[#0E7490] transition hover:bg-[#CFFAFE]"
              >
                Ver Núcleo Interno
              </button>
            </div>

            {/* 7 Anatomical Structures List */}
            <div className="space-y-1.5">
              {VIRUS_STRUCTURES.map((s) => {
                const isVis = visibility[s.id] !== false;
                const isSel = selectedId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectStructure(s.id)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-2 transition ${
                      isSel
                        ? 'border-[#0052A3] bg-[#E6F0FA] shadow-xs'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#0052A3]/45 hover:bg-[#F0F7FD]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-900/15"
                        style={{
                          backgroundColor: s.colorHex,
                          opacity: isVis ? 1 : 0.3,
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className={`truncate text-xs font-semibold ${
                          isVis
                            ? isSel
                              ? 'text-[#003E7E]'
                              : 'text-[#0F172A]'
                            : 'text-[#94A3B8] line-through'
                        }`}
                      >
                        {s.shortName}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleLayer(s.id, e)}
                      title={isVis ? `Ocultar ${s.shortName}` : `Exibir ${s.shortName}`}
                      aria-label={isVis ? `Ocultar ${s.shortName}` : `Exibir ${s.shortName}`}
                      className={`shrink-0 rounded-lg p-1.5 transition ${
                        isVis
                          ? 'text-[#0052A3] hover:bg-[#0052A3]/10'
                          : 'text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#475569]'
                      }`}
                    >
                      {isVis ? (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Exploded View Slider */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#1E293B]">
                  <Maximize2 className="h-3.5 w-3.5 text-[#0E7490]" aria-hidden="true" />
                  <span>Vista Explodida</span>
                </span>
                <span className="font-mono font-semibold text-[#0052A3] tabular-nums">
                  {explodePct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={explodePct}
                onChange={(e) => setExplodePct(Number(e.target.value))}
                aria-label="Controlar vista explodida de 0 a 100 por cento"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#CBD5E1] accent-[#0052A3]"
              />
            </div>

            {/* Cross-Section Mode Selector (Corte 1/4 · Corte 1/2 · Íntegro) */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <Scissors className="h-3.5 w-3.5 text-[#0052A3]" aria-hidden="true" />
                <span>Corte Transversal</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'quarter', label: 'Corte 1/4' },
                    { id: 'half', label: 'Ao meio' },
                    { id: 'full', label: 'Íntegro' },
                  ] as const
                ).map((m) => {
                  const active = cutMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCutMode(m.id)}
                      aria-pressed={active}
                      className={`rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition ${
                        active
                          ? 'border-[#0052A3] bg-[#0052A3] text-white shadow-xs'
                          : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155] hover:border-[#0052A3]/50 hover:bg-[#F0F7FD] hover:text-[#0F172A]'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Camera & Labels Controls */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                Visualização e Câmera
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAutoRotate((v) => !v)}
                  aria-pressed={autoRotate}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                    autoRotate
                      ? 'border-[#0052A3] bg-[#0052A3] text-white shadow-xs'
                      : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155] hover:border-[#0052A3]/50 hover:text-[#0F172A]'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Auto-rotação</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLabels((v) => !v)}
                  aria-pressed={showLabels}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                    showLabels
                      ? 'border-[#0052A3] bg-[#0052A3] text-white shadow-xs'
                      : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155] hover:border-[#0052A3]/50 hover:text-[#0F172A]'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Rótulos 3D</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCameraResetTrigger((n) => n + 1)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] transition hover:border-[#0052A3]/50 hover:bg-[#F0F7FD]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#0052A3]" aria-hidden="true" />
                <span>Resetar Câmera</span>
              </button>
            </div>
          </div>

          {/* Footer Navigation Hint */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-[11px] font-medium text-[#64748B]">
            <span>Arraste: girar</span>
            <span>Scroll: zoom</span>
            <span>Botão dir.: pan</span>
          </div>
        </aside>

        {/* Subtle Bottom-Center Prompt Pill when Ficha Estrutural is Collapsed */}
        {!detailsOpen && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#CBD5E1] bg-white/95 px-4 py-2 text-xs font-semibold text-[#0F172A] shadow-md transition hover:border-[#0052A3] hover:bg-[#F0F7FD]"
            >
              <FlaskConical className="h-3.5 w-3.5 text-[#0E7490]" aria-hidden="true" />
              <span>
                {selected ? `Ficha Estrutural: ${selected.shortName}` : 'Abrir Ficha Estrutural'}
              </span>
              <ChevronUp className="h-3.5 w-3.5 text-[#0052A3]" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Docked Ficha Estrutural Didática (Never Overlaps the 3D Virus Model) */}
      {detailsOpen && (
        <aside
          ref={detailsSectionRef}
          aria-label="Ficha Estrutural"
          aria-live="polite"
          className="w-full border-t border-[#CBD5E1] bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.06)]"
        >
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2.5">
                {selected ? (
                  <span
                    className="h-3 w-3 rounded-full ring-1 ring-slate-900/15"
                    style={{ backgroundColor: selected.colorHex }}
                    aria-hidden="true"
                  />
                ) : (
                  <FlaskConical className="h-4 w-4 text-[#0E7490]" aria-hidden="true" />
                )}
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Ficha Estrutural
                </h2>
                {selected && (
                  <span className="hidden text-xs font-medium text-[#475569] sm:inline">
                    — {selected.name}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onShareToClassroom && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selected) {
                        onShareToClassroom({
                          kind: 'assignment',
                          title: `Morfologia Viral 3D: ${selected.name} (${selected.layerScale})`,
                          description:
                            `Inspeção Morfológica e Farmacológica no Modelo 3D do Vírus Mpox (MPXV)\n` +
                            `Estrutura Selecionada: ${selected.name} (${selected.layerScale})\n\n` +
                            `Função Biológica:\n${selected.biology}\n\n` +
                            `Importância em Saúde Pública e Farmácia:\n${selected.publicHealth}\n\n` +
                            `Atividade Prática:\n` +
                            `1. Localize a estrutura "${selected.name}" no corte transversal 3D do Atlas Mpox · SUS (utilize a Vista Explodida para observar sua relação anatômica com as demais camadas).\n` +
                            `2. Explique como essa estrutura contribui para o ciclo replicativo do Orthopoxvirus ou atua como alvo diagnóstico/terapêutico na assistência farmacêutica.`,
                          maxPoints: 100,
                          topicName: '1. Virologia e Morfologia 3D',
                          sourceBadge: `Vírus 3D · ${selected.name}`,
                        });
                      } else {
                        onShareToClassroom({
                          kind: 'assignment',
                          title: 'Prática 3D: Arquitetura Completa do Vírus Mpox (Orthopoxvirus)',
                          description:
                            `Utilizando o modelo 3D interativo em corte transversal do Monkeypox virus (MPXV):\n\n` +
                            `1. Compare as 7 estruturas concêntricas (Membrana Externa, Túbulos de Superfície, Membrana Interna, Corpos Laterais, Camada Paliçada, Núcleo Bicôncavo e Genoma dsDNA ~197 kb).\n` +
                            `2. Explique a diferença entre as formas infectantes IMV e EEV e o mecanismo de ação do antiviral Tecovirimat (inibidor de VP37).`,
                          maxPoints: 100,
                          topicName: '1. Virologia e Morfologia 3D',
                          sourceBadge: 'Vírus 3D · Visão Geral',
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-1 text-[11px] font-semibold text-[#0F766E] transition hover:bg-[#0F766E] hover:text-white"
                  >
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Criar Atividade no Classroom</span>
                  </button>
                )}
                {selected && (
                  <button
                    type="button"
                    onClick={() => handleSelectStructure(null)}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0052A3] transition hover:border-[#0052A3] hover:bg-[#E6F0FA]"
                  >
                    Visão Geral
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  title="Recolher ficha estrutural"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] transition hover:bg-[#E2E8F0] hover:text-[#0F172A]"
                >
                  <span>Recolher</span>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:px-6 sm:py-5">
              {!selected ? (
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="space-y-3 lg:col-span-5">
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Arquitetura do Vírus Mpox
                    </h3>
                    <p className="text-xs leading-relaxed text-[#334155] sm:text-sm">
                      O <strong className="text-[#0F172A]">Monkeypox virus (MPXV)</strong> é um{' '}
                      <em>Orthopoxvirus</em> de grande porte em formato de{' '}
                      <strong className="text-[#0F172A]">&ldquo;tijolo arredondado&rdquo;</strong>{' '}
                      (ovoide achatado), medindo cerca de 300 × 200 × 170 nm. O corte transversal
                      revela sua organização em camadas concêntricas ao redor de um núcleo
                      bicôncavo.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:col-span-3">
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0052A3]">
                        Genoma
                      </span>
                      <p className="mt-1 text-sm font-bold text-[#0F172A]">dsDNA Linear</p>
                      <p className="mt-0.5 text-xs text-[#475569]">~197 kb (~190 genes)</p>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E7490]">
                        Replicação
                      </span>
                      <p className="mt-1 text-sm font-bold text-[#0F172A]">Citoplasmática</p>
                      <p className="mt-0.5 text-xs text-[#475569]">Enzimas no núcleo</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#BFD7EE] bg-[#F0F7FD] p-3.5 lg:col-span-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0052A3]">
                      Sugestão Didática
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#1E3A5F]">
                      Clique diretamente em qualquer camada do modelo 3D, nos rótulos flutuantes ou
                      na lista lateral. Experimente também{' '}
                      <strong className="text-[#0F172A]">&ldquo;Ver Núcleo Interno&rdquo;</strong>,{' '}
                      <strong className="text-[#0F172A]">&ldquo;Ao meio&rdquo;</strong> ou a{' '}
                      <strong className="text-[#0F172A]">&ldquo;Vista Explodida&rdquo;</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="space-y-2 lg:col-span-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#0F172A]"
                      style={{
                        borderColor: `${selected.colorHex}80`,
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-slate-900/15"
                        style={{ backgroundColor: selected.colorHex }}
                        aria-hidden="true"
                      />
                      <span>{selected.layerScale}</span>
                    </span>
                    <h3 className="text-lg font-bold leading-snug text-[#0F172A]">
                      {selected.name}
                    </h3>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 lg:col-span-4">
                    <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0052A3]">
                      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Função Biológica</span>
                    </h4>
                    <p className="text-xs leading-relaxed text-[#1E293B] sm:text-sm">
                      {selected.biology}
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-[#BFD7EE] bg-[#F0F7FD] p-4 lg:col-span-5">
                    <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0E7490]">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Importância Didática / Saúde Pública</span>
                    </h4>
                    <p className="text-xs leading-relaxed text-[#1E293B] sm:text-sm">
                      {selected.publicHealth}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </section>
  );
};
