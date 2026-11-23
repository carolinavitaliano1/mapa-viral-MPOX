import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Pencil, RotateCcw, X } from 'lucide-react';
import { DEFAULT_GITHUB_URL } from '../data/mpoxTimeline';

interface GithubModalProps {
  open: boolean;
  githubUrl: string;
  onSaveUrl: (nextUrl: string) => void;
  onClose: () => void;
}

export const GithubModal: React.FC<GithubModalProps> = ({
  open,
  githubUrl,
  onSaveUrl,
  onClose,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState(githubUrl);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState('');

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(githubUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard unavailable
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftUrl.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setValidationError('Informe uma URL válida iniciando com https://');
      return;
    }
    setValidationError('');
    onSaveUrl(trimmed);
    setEditing(false);
  };

  const handleReset = () => {
    setDraftUrl(DEFAULT_GITHUB_URL);
    onSaveUrl(DEFAULT_GITHUB_URL);
    setValidationError('');
    setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#CBD5E1] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0052A3]">
              Ciência Aberta · Extensão Universitária em Farmácia
            </p>
            <h2
              id="github-modal-title"
              className="mt-1 font-display text-lg font-bold text-[#0F172A]"
            >
              Repositório de Código e Scripts (GitHub)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            aria-label="Fechar janela"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#334155]">
          Acesse ou configure o link do repositório GitHub do seu projeto de extensão contendo a
          aplicação do globo 3D, os scripts reprodutíveis em R e Python e o dicionário de dados do
          SINAN/SUS.
        </p>

        {!editing ? (
          <div className="mt-4 rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-3.5">
            <div className="text-xs font-medium text-[#475569]">Link atual do repositório</div>
            <div className="mt-1 break-all font-mono text-xs text-[#0F172A]">
              {githubUrl}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0052A3] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#003E7E]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Abrir no GitHub</span>
              </a>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#047857]" aria-hidden="true" />
                    <span>Link copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setDraftUrl(githubUrl);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Editar link</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-4 rounded-lg border border-[#D5E0EA] bg-[#F8FAFC] p-4">
            <label
              htmlFor="github-url-input"
              className="block text-xs font-semibold text-[#1E293B]"
            >
              URL personalizada do repositório (GitHub / GitHub Pages)
            </label>
            <input
              id="github-url-input"
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://github.com/seu-usuario/atlas-mpox-sus"
              className="mt-2 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] placeholder-[#64748B] focus:border-[#0052A3] focus:outline-none"
              required
            />
            {validationError && (
              <p className="mt-1.5 text-xs font-medium text-[#C81E3A]">{validationError}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[#0052A3] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#003E7E]"
              >
                Salvar link
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValidationError('');
                }}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#334155] hover:bg-[#F1F5F9]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#475569] hover:text-[#0052A3]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restaurar padrão</span>
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 border-t border-[#E2E8F0] pt-3.5">
          <p className="text-xs font-semibold text-[#1E293B]">
            Estrutura sugerida para publicação acadêmica
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-[#475569]">
            <li>scripts/analise_mpox_sus.R · Incidência, letalidade e IC95% (epiR)</li>
            <li>scripts/vigilancia_mpox.py · Pipeline pandas + teste Qui-Quadrado</li>
            <li>dados/boletim_sinan_referencia.csv · Variáveis agregadas por UF e clado</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
