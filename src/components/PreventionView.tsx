import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SUS_WORKFLOW_STAGES } from '../data/mpoxTimeline';

export const PreventionView: React.FC = () => {
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const currentStage = SUS_WORKFLOW_STAGES[activeStageIdx];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:py-12">
      {/* Header */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold text-[#0052A3]">
          Prevenção no Trabalho & SUS · Educação em Saúde Sem Estigma
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          Biossegurança, Fluxo Assistencial no SUS e Atuação Farmacêutica
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#334155]">
          Diretrizes baseadas em evidências da Fiocruz, Ministério da Saúde e ANVISA para proteção
          de trabalhadores, acolhimento humanizado, diagnóstico oportuno e equidade no cuidado a
          grupos vulneráveis.
        </p>
      </header>

      {/* Section 1: Interactive 4-Stage SUS Clinical & Laboratory Workflow */}
      <section className="mt-10 rounded-xl border border-[#CBD5E1] bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[#0F172A]">
            Linha de Cuidado e Vigilância no SUS
          </h2>
          <span className="text-xs text-[#475569]">
            Selecione cada etapa para consultar condutas recomendadas
          </span>
        </div>

        {/* Interactive Stage Selector */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {SUS_WORKFLOW_STAGES.map((stage, idx) => {
            const isActive = idx === activeStageIdx;
            return (
              <button
                key={stage.step}
                type="button"
                onClick={() => setActiveStageIdx(idx)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  isActive
                    ? 'border-[#0052A3] bg-[#E6F0FA]'
                    : 'border-[#D5E0EA] bg-[#F8FAFC] hover:border-[#94A3B8] hover:bg-[#F1F5F9]'
                }`}
              >
                <div
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    isActive ? 'text-[#0052A3]' : 'text-[#0E7490]'
                  }`}
                >
                  Etapa {stage.step}
                </div>
                <div className="mt-1 font-display text-sm font-semibold text-[#0F172A]">
                  {stage.title}
                </div>
                <div className="mt-1 text-xs text-[#475569]">{stage.unit}</div>
              </button>
            );
          })}
        </div>

        {/* Active Stage Detail Panel */}
        <div className="mt-5 rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
            <span className="font-mono font-semibold text-[#0052A3]">
              Etapa {currentStage.step}
            </span>
            <span aria-hidden="true">·</span>
            <span>{currentStage.unit}</span>
          </div>
          <h3 className="mt-1.5 font-display text-xl font-bold text-[#0F172A]">
            {currentStage.title}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#334155]">
            {currentStage.description}
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {currentStage.actions.map((action) => (
              <li
                key={action}
                className="rounded-lg border border-[#D5E0EA] bg-white p-3.5 text-xs leading-relaxed text-[#1E293B]"
              >
                {action}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 2: Workplace & Pharmacy Biosafety (3-Column Grid) */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#0052A3]" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-[#0F172A]">
            Prevenção no Ambiente de Trabalho e Serviços de Farmácia
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="rounded-xl border border-[#CBD5E1] bg-white p-5">
            <p className="font-mono text-xs font-semibold text-[#0052A3]">01 · Proteção Profissional</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[#0F172A]">
              Precauções de Contato e Gotículas
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#334155]">
              Em farmácias comunitárias, ambulatórios e hospitais, a transmissão ocorre sobretudo por
              contato direto com lesões, fluidos corporais, objetos contaminados ou gotículas em
              contato próximo prolongado.
            </p>
            <ul className="mt-3.5 space-y-2 border-t border-[#E2E8F0] pt-3.5 text-xs leading-relaxed text-[#1E293B]">
              <li>Higienização rigorosa das mãos com água e sabonete ou álcool 70%.</li>
              <li>Uso de luvas descartáveis, avental e máscara cirúrgica no atendimento clínico.</li>
              <li>Máscara PFF2/N95 e proteção ocular durante coleta de swab ou manejo de roupas.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-[#CBD5E1] bg-white p-5">
            <p className="font-mono text-xs font-semibold text-[#0E7490]">02 · Ambiente e Fômites</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[#0F172A]">
              Superfícies, Enxoval e Resíduos
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#334155]">
              O Orthopoxvirus pode permanecer viável em superfícies e tecidos. Protocolos simples de
              limpeza úmida interrompem a cadeia de transmissão indireta no local de trabalho.
            </p>
            <ul className="mt-3.5 space-y-2 border-t border-[#E2E8F0] pt-3.5 text-xs leading-relaxed text-[#1E293B]">
              <li>Evitar varredura seca ou sacudir roupas de cama e jalecos contaminados.</li>
              <li>Desinfetar bancadas, balcões e maçanetas com saneantes regularizados na ANVISA.</li>
              <li>Descartar curativos e EPIs contaminados em saco branco leitoso (RSS Grupo A).</li>
            </ul>
          </article>

          <article className="rounded-xl border border-[#CBD5E1] bg-white p-5">
            <p className="font-mono text-xs font-semibold text-[#B45309]">03 · Conduta Trabalhista</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[#0F172A]">
              Afastamento e Retorno Seguro
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#334155]">
              Trabalhadores com suspeita ou confirmação precisam de garantia de sigilo, orientação
              médica e afastamento adequado sem penalização ou exposição constrangedora.
            </p>
            <ul className="mt-3.5 space-y-2 border-t border-[#E2E8F0] pt-3.5 text-xs leading-relaxed text-[#1E293B]">
              <li>Encaminhar imediatamente à UBS/serviço de saúde ocupacional para avaliação e PCR.</li>
              <li>Manter isolamento até queda total das crostas e formação de nova camada de pele.</li>
              <li>Monitorar contatos próximos por 21 dias sem necessidade de afastamento se assintomáticos.</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Section 3: Stigma-Free Communication & Vulnerable Groups */}
      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
        {/* Communication without stigma */}
        <div className="rounded-xl border border-[#CBD5E1] bg-white p-6">
          <p className="text-xs font-semibold text-[#C81E3A]">Comunicação Científica Sem Estigma</p>
          <h2 className="mt-1.5 font-display text-lg font-bold text-[#0F172A]">
            Informação Correta Salva Vidas e Protege a Fauna
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4">
              <div className="text-xs font-semibold text-[#0052A3]">
                Macacos não são os vilões nem o reservatório principal
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#334155]">
                Embora o vírus tenha sido isolado em 1958 em colônias de macacos de pesquisa na
                Dinamarca, o reservatório natural silvestre envolve pequenos mamíferos (como
                roedores) na África Central e Ocidental. A transmissão atual ocorre principalmente de
                pessoa para pessoa.
              </p>
            </div>

            <div className="rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4">
              <div className="text-xs font-semibold text-[#0052A3]">
                Qualquer pessoa exposta pode contrair Mpox
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#334155]">
                O estigma atrasa a busca por diagnóstico e prejudica o rastreamento de contatos. A
                terminologia oficial adotada pela OMS e pelo SUS é <strong className="text-[#0F172A]">Mpox</strong>,
                reforçando o cuidado acolhedor, confidencial e baseado em risco real de exposição.
              </p>
            </div>
          </div>
        </div>

        {/* Vulnerable Groups & Pharmacist Role */}
        <div className="rounded-xl border border-[#CBD5E1] bg-white p-6">
          <p className="text-xs font-semibold text-[#0E7490]">Equidade no SUS · Prioridade Clínica</p>
          <h2 className="mt-1.5 font-display text-lg font-bold text-[#0F172A]">
            Grupos Vulneráveis e Papel do Farmacêutico
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#334155]">
            Desde os registros de julho e agosto de 2022 no Brasil — incluindo o primeiro óbito fora
            da África em paciente imunossuprimido (29/07/2022) e os primeiros casos em gestantes
            (02/08/2022, Campinas e Guarulhos) — a vigilância prioriza:
          </p>

          <dl className="mt-4 space-y-3 border-t border-[#E2E8F0] pt-4 text-sm">
            <div>
              <dt className="font-semibold text-[#0F172A]">
                Pessoas imunossuprimidas (ex.: HIV/aids com CD4 baixo, transplantados)
              </dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-[#334155]">
                Maior risco de lesões extensas, infecções secundárias e desfechos graves; requerem
                avaliação médica prioritária e revisão cuidadosa de interações medicamentosas.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#0F172A]">Gestantes, puérperas e crianças</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-[#334155]">
                Necessitam de acompanhamento obstétrico/pediátrico próximo devido ao risco de
                transmissão vertical e maior vulnerabilidade clínica.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#0F172A]">
                Atuação do Farmacêutico na Atenção Primária e Hospitalar
              </dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-[#334155]">
                Acolhimento inicial na farmácia, orientação contra automedicação tópica inadequada,
                farmacovigilância, apoio à adesão terapêutica e educação em saúde baseada na Fiocruz
                e no Ministério da Saúde.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
};
