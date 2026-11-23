import React, { useState } from 'react';
import { Code2, Menu, X } from 'lucide-react';

export type ActiveSection = 'mapa' | 'virus' | 'dados' | 'prevencao';

interface TopNavProps {
  activeSection: ActiveSection;
  onChangeSection: (section: ActiveSection) => void;
  onOpenGithubModal: () => void;
}

const NAV_ITEMS: { id: ActiveSection; label: string }[] = [
  { id: 'mapa', label: 'Mapa 3D (História)' },
  { id: 'virus', label: 'Vírus Mpox 3D' },
  { id: 'dados', label: 'Dados & Bioestatística' },
  { id: 'prevencao', label: 'Prevenção & SUS' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeSection,
  onChangeSection,
  onOpenGithubModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (id: ActiveSection) => {
    onChangeSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#CBD5E1] bg-white">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('mapa')}
          className="font-display text-base font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 transition-colors hover:text-[#0052A3]"
        >
          Atlas Mpox · SUS
        </button>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          className="hidden lg:flex items-center gap-6"
          aria-label="Seções principais"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'font-semibold text-[#0052A3]'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2.5px] bg-[#0052A3]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenGithubModal}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#0052A3] px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-[#003E7E]"
          >
            <Code2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Ver Código e Scripts no GitHub</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-lg border border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9]"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <div className="border-t border-[#CBD5E1] bg-white px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Menu móvel">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#E6F0FA] font-semibold text-[#0052A3]'
                      : 'text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="font-mono text-xs text-[#0052A3]">Ativo</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenGithubModal();
              }}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0052A3] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003E7E]"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
              <span>Ver Código e Scripts no GitHub</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};
