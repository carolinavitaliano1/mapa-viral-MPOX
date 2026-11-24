import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Edit3,
  ExternalLink,
  FolderOpen,
  Globe2,
  GraduationCap,
  Link2,
  Loader2,
  Megaphone,
  Microscope,
  Pin,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { LiveMpoxController } from '../hooks/useLiveMpoxData';
import {
  ClassroomAnnouncement,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomCourseWorkMaterial,
  ClassroomTopic,
  listClassroomCourses,
  listCourseAnnouncements,
  listCourseStudents,
  listCourseTopics,
  listCourseWork,
  listCourseWorkMaterials,
} from '../utils/googleClassroomApi';
import { googleSignIn, initAuth } from '../utils/googleClassroomAuth';
import { ActiveSection } from './TopNav';

const HERO_IMAGE_PATH = '/src/assets/images/hero_atlas_mpox_sus_1795474903496.jpg';
const AUTHOR_STORAGE_KEY = 'atlas_mpox_sus_author_profile_v3';
const CLASSROOM_SHOWCASE_STORAGE_KEY = 'atlas_mpox_sus_classroom_showcase_v1';

interface AuthorProfile {
  name: string;
  instagram: string;
  instagramUrl: string;
  linkedinUrl: string;
  academicId: string;
  institution: string;
  email: string;
}

interface SavedClassroomShowcase {
  courseId?: string;
  name: string;
  section: string;
  room: string;
  description: string;
  enrollmentCode: string;
  inviteLink: string;
  alternateLink: string;
  studentCount: number;
  topics: ClassroomTopic[];
  courseWork: ClassroomCourseWork[];
  materials: ClassroomCourseWorkMaterial[];
  announcements: ClassroomAnnouncement[];
  syncedAt?: string;
}

const DEFAULT_AUTHOR: AuthorProfile = {
  name: 'Carolina Vitaliano',
  instagram: '@carolgurgel_biofarma',
  instagramUrl:
    'https://www.instagram.com/carolgurgel_biofarma?lqvp=MTc3eGZ6Y2ZtOHB2cQ%3D%3D&utm_source=qr',
  linkedinUrl: 'https://www.linkedin.com/in/carolinavitaliano',
  academicId: '',
  institution: 'Graduação em Farmácia · Projeto de Extensão em Saúde Pública e SUS',
  email: 'carolinavitaliano1@gmail.com',
};

const DEFAULT_CLASSROOM_SHOWCASE: SavedClassroomShowcase = {
  name: 'Atlas Mpox · Extensão Universitária em Farmácia (SUS)',
  section: 'Saúde Pública, Epidemiologia e Virologia Aplicada',
  room: 'Sala Virtual · Google Classroom',
  description:
    'Turma oficial do projeto de extensão para acompanhamento dos estudos de caso 3D (Globo Histórico e Morfologia do Orthopoxvirus), práticas de bioestatística em R/Python e discussão de protocolos assistenciais no SUS.',
  enrollmentCode: '',
  inviteLink: '',
  alternateLink: 'https://classroom.google.com',
  studentCount: 0,
  topics: [
    { courseId: 'default', topicId: 't1', name: '1. Virologia e Morfologia 3D (MPXV)' },
    { courseId: 'default', topicId: 't2', name: '2. Epidemiologia Histórica e Clados (1958–2025)' },
    { courseId: 'default', topicId: 't3', name: '3. Bioestatística em Saúde Pública (R & Python)' },
    { courseId: 'default', topicId: 't4', name: '4. Vigilância, Farmacoterapia e Prevenção no SUS' },
  ],
  courseWork: [],
  materials: [],
  announcements: [],
};

interface HomeViewProps {
  liveData: LiveMpoxController;
  onNavigate: (section: ActiveSection) => void;
  onOpenClassroomModal: () => void;
  onOpenGithubModal: () => void;
}

type ClassroomContentTab = 'tudo' | 'atividades' | 'materiais' | 'mural' | 'topicos';

function normalizeInstagramHandle(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '');
  if (!cleaned) return '';
  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

function buildInstagramUrl(handleOrUrl: string, explicitUrl?: string): string | null {
  if (explicitUrl && /^https?:\/\/(www\.)?instagram\.com\//i.test(explicitUrl.trim())) {
    return explicitUrl.trim();
  }
  if (/^https?:\/\/(www\.)?instagram\.com\//i.test(handleOrUrl.trim())) {
    return handleOrUrl.trim();
  }
  const normalized = normalizeInstagramHandle(handleOrUrl).replace(/^@/, '');
  if (!normalized) return null;
  return `https://www.instagram.com/${encodeURIComponent(normalized)}/`;
}

function normalizeLinkedinUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)?linkedin\.com\//i.test(trimmed)) return `https://${trimmed}`;
  return `https://www.linkedin.com/in/${encodeURIComponent(trimmed.replace(/^@/, ''))}`;
}

function formatLinkedinLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'in' && parts[1]) {
      return `in/${parts[1]}`;
    }
    return 'Perfil no LinkedIn';
  } catch {
    return 'Perfil no LinkedIn';
  }
}

function buildDirectJoinUrl(course: {
  inviteLink?: string;
  alternateLink?: string;
  enrollmentCode?: string;
}): string {
  if (course.inviteLink && /^https?:\/\//i.test(course.inviteLink.trim())) {
    return course.inviteLink.trim();
  }
  if (course.alternateLink && /^https?:\/\//i.test(course.alternateLink.trim())) {
    if (course.enrollmentCode && !course.alternateLink.includes('cjc=')) {
      const sep = course.alternateLink.includes('?') ? '&' : '?';
      return `${course.alternateLink}${sep}cjc=${encodeURIComponent(course.enrollmentCode)}`;
    }
    return course.alternateLink;
  }
  return 'https://classroom.google.com';
}

export const HomeView: React.FC<HomeViewProps> = ({
  liveData,
  onNavigate,
  onOpenClassroomModal,
  onOpenGithubModal,
}) => {
  // Hero image resilient fallback
  const [heroImgError, setHeroImgError] = useState(false);

  // Author profile state (persisted in localStorage)
  const [author, setAuthor] = useState<AuthorProfile>(() => {
    try {
      const raw = window.localStorage.getItem(AUTHOR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AuthorProfile>;
        return { ...DEFAULT_AUTHOR, ...parsed };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_AUTHOR;
  });
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [authorDraft, setAuthorDraft] = useState<AuthorProfile>(author);

  // Saved / pinned public classroom showcase
  const [showcase, setShowcase] = useState<SavedClassroomShowcase>(() => {
    try {
      const raw = window.localStorage.getItem(CLASSROOM_SHOWCASE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedClassroomShowcase>;
        return { ...DEFAULT_CLASSROOM_SHOWCASE, ...parsed };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_CLASSROOM_SHOWCASE;
  });
  const [editingClassroomConfig, setEditingClassroomConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState({
    name: showcase.name,
    section: showcase.section,
    description: showcase.description,
    enrollmentCode: showcase.enrollmentCode,
    inviteLink: showcase.inviteLink,
  });

  // Live Google Classroom Auth & API state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [classroomError, setClassroomError] = useState<string | null>(null);
  const [classroomNotice, setClassroomNotice] = useState<string | null>(null);

  const [liveCourses, setLiveCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(showcase.courseId ?? '');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [activeClassTab, setActiveClassTab] = useState<ClassroomContentTab>('tudo');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync Firebase Auth status on mount
  useEffect(() => {
    const unsub = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setIsAuthed(true);
      },
      () => {
        setUser(null);
        setIsAuthed(false);
      }
    );
    return () => unsub();
  }, []);

  // Load real courses once authenticated
  useEffect(() => {
    if (isAuthed) {
      void loadRealCourses();
    }
  }, [isAuthed]);

  // Load full class contents when selected course changes while authenticated
  useEffect(() => {
    if (isAuthed && selectedCourseId) {
      const targetCourse = liveCourses.find((c) => c.id === selectedCourseId);
      if (targetCourse) {
        void loadRealCourseContents(targetCourse);
      }
    }
  }, [isAuthed, selectedCourseId, liveCourses]);

  const persistShowcase = (next: SavedClassroomShowcase) => {
    setShowcase(next);
    try {
      window.localStorage.setItem(CLASSROOM_SHOWCASE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const loadRealCourses = async () => {
    setLoadingCourses(true);
    setClassroomError(null);
    try {
      const list = await listClassroomCourses();
      setLiveCourses(list);
      if (list.length > 0) {
        setSelectedCourseId((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : list[0].id
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'AUTH_REQUIRED') {
        setIsAuthed(false);
      } else {
        setClassroomError(msg);
      }
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadRealCourseContents = async (course: ClassroomCourse) => {
    setLoadingDetails(true);
    setClassroomError(null);
    try {
      const [topics, courseWork, materials, announcements, students] = await Promise.all([
        listCourseTopics(course.id),
        listCourseWork(course.id),
        listCourseWorkMaterials(course.id),
        listCourseAnnouncements(course.id),
        listCourseStudents(course.id),
      ]);

      const nextShowcase: SavedClassroomShowcase = {
        courseId: course.id,
        name: course.name,
        section: course.section || '',
        room: course.room || '',
        description:
          course.description ||
          course.descriptionHeading ||
          'Turma vinculada ao projeto de extensão Atlas Mpox · SUS no Google Classroom.',
        enrollmentCode: course.enrollmentCode || showcase.enrollmentCode || '',
        inviteLink:
          showcase.courseId === course.id && showcase.inviteLink
            ? showcase.inviteLink
            : buildDirectJoinUrl({
                alternateLink: course.alternateLink,
                enrollmentCode: course.enrollmentCode,
              }),
        alternateLink: course.alternateLink || 'https://classroom.google.com',
        studentCount: students.length,
        topics,
        courseWork,
        materials,
        announcements,
        syncedAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      persistShowcase(nextShowcase);
      setConfigDraft({
        name: nextShowcase.name,
        section: nextShowcase.section,
        description: nextShowcase.description,
        enrollmentCode: nextShowcase.enrollmentCode,
        inviteLink: nextShowcase.inviteLink,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'AUTH_REQUIRED') {
        setIsAuthed(false);
      } else {
        setClassroomError(msg);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleGoogleConnect = async () => {
    setIsLoggingIn(true);
    setClassroomError(null);
    setClassroomNotice(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setIsAuthed(true);
        setClassroomNotice(
          'Conta Google Classroom conectada! Selecione sua turma abaixo para exibir todos os dados e o link de entrada.'
        );
      }
    } catch (err) {
      setClassroomError(
        err instanceof Error ? err.message : 'Não foi possível conectar ao Google Classroom.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveAuthor = (e: React.FormEvent) => {
    e.preventDefault();
    const rawIgInput = authorDraft.instagram.trim();
    const nextIgUrl = /^https?:\/\/(www\.)?instagram\.com\//i.test(rawIgInput)
      ? rawIgInput
      : normalizeInstagramHandle(rawIgInput) === DEFAULT_AUTHOR.instagram
        ? DEFAULT_AUTHOR.instagramUrl
        : buildInstagramUrl(rawIgInput) ?? '';

    const cleaned: AuthorProfile = {
      name: authorDraft.name.trim() || DEFAULT_AUTHOR.name,
      instagram: normalizeInstagramHandle(rawIgInput),
      instagramUrl: nextIgUrl,
      linkedinUrl: normalizeLinkedinUrl(authorDraft.linkedinUrl),
      academicId: authorDraft.academicId.trim(),
      institution: authorDraft.institution.trim() || DEFAULT_AUTHOR.institution,
      email: authorDraft.email.trim(),
    };
    setAuthor(cleaned);
    try {
      window.localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // ignore
    }
    setEditingAuthor(false);
  };

  const handleSaveClassroomConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SavedClassroomShowcase = {
      ...showcase,
      name: configDraft.name.trim() || showcase.name,
      section: configDraft.section.trim(),
      description: configDraft.description.trim(),
      enrollmentCode: configDraft.enrollmentCode.trim(),
      inviteLink: configDraft.inviteLink.trim(),
    };
    persistShowcase(updated);
    setEditingClassroomConfig(false);
    setClassroomNotice('Dados públicos da turma e link de convite salvos nesta página inicial.');
  };

  const handleCopyText = async (text: string, target: 'code' | 'link') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (target === 'code') {
        setCopiedCode(true);
        window.setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      // ignore clipboard restriction
    }
  };

  const directJoinUrl = buildDirectJoinUrl(showcase);
  const hasRealJoinLink =
    Boolean(showcase.inviteLink && /^https?:\/\//i.test(showcase.inviteLink)) ||
    Boolean(showcase.alternateLink && showcase.alternateLink !== 'https://classroom.google.com');
  const igUrl = buildInstagramUrl(author.instagram, author.instagramUrl);
  const linkedinHref = author.linkedinUrl ? normalizeLinkedinUrl(author.linkedinUrl) : '';

  const globalCases = liveData.snapshot?.global.totalCases
    ? liveData.snapshot.global.totalCases.toLocaleString('pt-BR')
    : '100.000+';
  const brazilCases = liveData.snapshot?.brazil.totalCases
    ? liveData.snapshot.brazil.totalCases.toLocaleString('pt-BR')
    : '12.000+';

  const MODULES: {
    id: ActiveSection;
    index: string;
    meta: string;
    title: string;
    description: string;
    cta: string;
    accentColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'mapa',
      index: '01.',
      meta: 'Cartografia 3D · 8 marcos · 1958–2025',
      title: 'Atlas 3D (História da Mpox)',
      description:
        'Globo terrestre interativo com a trajetória histórica do vírus da Dinamarca (1958) e RDC (1970) até o Brasil e o Clado Ib, integrado com colunas 3D por UF e série ao vivo da OMS.',
      cta: 'Explorar Atlas 3D',
      accentColor: 'text-[#0052A3]',
      icon: Globe2,
    },
    {
      id: 'virus',
      index: '02.',
      meta: 'Anatomia PBR 3D · 7 camadas · ~197 kb dsDNA',
      title: 'Vírus Mpox 3D (MPXV)',
      description:
        'Modelo morfológico interativo em corte transversal e vista explodida do Orthopoxvirus, detalhando membrana externa, corpos laterais, núcleo bicôncavo e alvo do antiviral Tecovirimat (VP37).',
      cta: 'Inspecionar Vírus 3D',
      accentColor: 'text-[#0E7490]',
      icon: Microscope,
    },
    {
      id: 'dados',
      index: '03.',
      meta: 'OMS em tempo real · Calculadora · R & Python',
      title: 'Dados & Bioestatística',
      description:
        'Painel de vigilância atualizado da OMS/OWID, calculadora epidemiológica com Intervalo de Confiança de 95% (Wilson), comparativo de Clados I e II e scripts reprodutíveis em R e Python.',
      cta: 'Abrir Bioestatística',
      accentColor: 'text-[#0F766E]',
      icon: BarChart3,
    },
    {
      id: 'prevencao',
      index: '04.',
      meta: 'Fiocruz · Ministério da Saúde · ANVISA',
      title: 'Prevenção & SUS',
      description:
        'Linha de cuidado em 4 etapas no SUS, protocolos de biossegurança em farmácias e UBS, coleta de swab para diagnóstico qPCR, manejo sintomático seguro e educação em saúde sem estigma.',
      cta: 'Consultar Protocolos SUS',
      accentColor: 'text-[#B45309]',
      icon: ShieldCheck,
    },
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-12">
      {/* SECTION 1: HERO SPLIT — PROJECT PRESENTATION + AUTHOR IDENTITY + SCIENTIFIC VISUAL */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {/* Left: Project Narrative & Author Profile */}
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <p className="text-xs font-semibold text-[#0052A3]">
              Projeto de Extensão Universitária em Farmácia · Saúde Pública e Vigilância no SUS
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-4xl lg:text-[42px]">
              Atlas Mpox · Ciência, Virologia 3D e Educação em Saúde no SUS
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#334155] sm:text-base">
              Plataforma educativa interativa criada para aproximar a pesquisa universitária em
              Farmácia da comunidade acadêmica e dos profissionais de saúde. Reúne cartografia
              epidemiológica em 3D, morfologia viral em corte transversal, bioestatística aberta em
              R e Python e diretrizes assistenciais do SUS — integrada diretamente à nossa turma no{' '}
              <strong className="font-semibold text-[#0F172A]">Google Classroom</strong>.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('mapa')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0052A3] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003E7E]"
              >
                <span>Iniciar pelo Atlas 3D</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <a
                href="#turma-classroom"
                className="inline-flex items-center gap-2 rounded-lg border border-[#0F766E] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F766E] transition-colors hover:bg-[#F0FDFA]"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                <span>Ver Turma no Google Classroom</span>
              </a>
            </div>
          </div>

          {/* Author & Instagram / Academic Identity Block */}
          <div className="mt-8 rounded-xl border border-[#CBD5E1] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div>
                <p className="text-xs font-semibold text-[#0052A3]">Autoria e Coordenação</p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-[#0F172A]">
                  {author.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAuthorDraft(author);
                  setEditingAuthor((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#334155] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
              >
                {editingAuthor ? (
                  <>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Cancelar</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Editar perfil</span>
                  </>
                )}
              </button>
            </div>

            {!editingAuthor ? (
              <div className="mt-3.5 grid grid-cols-1 gap-3.5 text-xs sm:grid-cols-2">
                <div>
                  <div className="font-medium text-[#64748B]">Instagram</div>
                  {author.instagram && igUrl ? (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#0052A3] hover:underline"
                    >
                      <span>{author.instagram}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthorDraft(author);
                        setEditingAuthor(true);
                      }}
                      className="mt-0.5 font-semibold text-[#0052A3] hover:underline"
                    >
                      Adicionar @Instagram
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-medium text-[#64748B]">LinkedIn</div>
                  {linkedinHref ? (
                    <a
                      href={linkedinHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#0A66C2] hover:underline"
                    >
                      <span>{formatLinkedinLabel(linkedinHref)}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthorDraft(author);
                        setEditingAuthor(true);
                      }}
                      className="mt-0.5 inline-flex items-center gap-1 font-semibold text-[#0A66C2] hover:underline"
                    >
                      <span>Adicionar link do LinkedIn</span>
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-medium text-[#64748B]">Curso / Extensão</div>
                  <div className="mt-0.5 font-medium text-[#0F172A]">{author.institution}</div>
                </div>

                <div>
                  <div className="font-medium text-[#64748B]">
                    {author.academicId ? 'Registro Acadêmico / Contato' : 'Contato Acadêmico'}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-medium text-[#1E293B]">
                    {author.academicId ? `${author.academicId} · ` : ''}
                    {author.email}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveAuthor} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B]">
                      Seu Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={authorDraft.name}
                      onChange={(e) =>
                        setAuthorDraft((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B]">
                      Instagram (@usuário ou link completo)
                    </label>
                    <input
                      type="text"
                      value={authorDraft.instagram}
                      onChange={(e) =>
                        setAuthorDraft((prev) => ({ ...prev, instagram: e.target.value }))
                      }
                      placeholder="@carolgurgel_biofarma"
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#1E293B]">
                      LinkedIn (URL completa ou usuário)
                    </label>
                    <input
                      type="text"
                      value={authorDraft.linkedinUrl}
                      onChange={(e) =>
                        setAuthorDraft((prev) => ({ ...prev, linkedinUrl: e.target.value }))
                      }
                      placeholder="https://www.linkedin.com/in/seu-perfil"
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B]">
                      RGM / RA / Matrícula (opcional)
                    </label>
                    <input
                      type="text"
                      value={authorDraft.academicId}
                      onChange={(e) =>
                        setAuthorDraft((prev) => ({ ...prev, academicId: e.target.value }))
                      }
                      placeholder="Ex.: RGM 12345678"
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B]">
                      Instituição / Curso
                    </label>
                    <input
                      type="text"
                      value={authorDraft.institution}
                      onChange={(e) =>
                        setAuthorDraft((prev) => ({ ...prev, institution: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAuthor(false)}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0052A3] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#003E7E]"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Salvar Dados</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right: Balanced Scientific Editorial Visual */}
        <div className="lg:col-span-5">
          <div className="relative h-64 overflow-hidden rounded-2xl border border-[#CBD5E1] bg-[#EAF1F7] sm:h-80 lg:h-full">
            {!heroImgError ? (
              <img
                src={HERO_IMAGE_PATH}
                alt="Ilustração científica do globo terrestre com rotas epidemiológicas e corte transversal do vírus Mpox"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#EAF2FA] via-[#F4F7FA] to-[#E6F4F1] p-8 text-center">
                <Globe2 className="h-14 w-14 text-[#0052A3]" aria-hidden="true" />
                <p className="mt-3 font-display text-base font-bold text-[#0F172A]">
                  Atlas Mpox · SUS
                </p>
                <p className="mt-1 text-xs text-[#475569]">
                  Cartografia 3D · Virologia MPXV · Bioestatística Aberta
                </p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 via-slate-900/35 to-transparent p-4 text-white">
              <p className="text-xs font-semibold">
                Vigilância Epidemiológica & Modelagem 3D Interativa
              </p>
              <p className="mt-0.5 text-[11px] text-slate-200">
                Referências: OMS · Ministério da Saúde · Fiocruz · Instituto Adolfo Lutz
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: 4-COLUMN LIVE PROOF METRICS STRIP */}
      <section
        aria-label="Indicadores do projeto e vigilância OMS"
        className="mt-8 grid grid-cols-2 gap-4 rounded-xl border border-[#CBD5E1] bg-white p-5 lg:grid-cols-4"
      >
        <div className="border-r-0 lg:border-r lg:border-[#E2E8F0] lg:pr-4">
          <div className="text-xs font-medium text-[#475569]">Casos Globais · OMS</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            {globalCases}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Série oficial sincronizada</div>
        </div>

        <div className="lg:border-r lg:border-[#E2E8F0] lg:pr-4">
          <div className="text-xs font-medium text-[#475569]">Casos no Brasil · OMS</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0052A3]">
            {brazilCases}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Monitoramento nacional SUS</div>
        </div>

        <div className="lg:border-r lg:border-[#E2E8F0] lg:pr-4">
          <div className="text-xs font-medium text-[#475569]">Cartografia Histórica 3D</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            8 marcos
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Trajetória global 1958–2025</div>
        </div>

        <div>
          <div className="text-xs font-medium text-[#475569]">Morfologia Viral MPXV</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0E7490]">
            7 camadas
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Corte transversal e vista explodida</div>
        </div>
      </section>

      {/* SECTION 3: GOOGLE CLASSROOM CREATED CLASS SHOWCASE & DIRECT JOIN LINK */}
      <section
        id="turma-classroom"
        aria-labelledby="classroom-showcase-heading"
        className="mt-12 rounded-2xl border border-[#CBD5E1] bg-white p-6 sm:p-8"
      >
        {/* Top Row: Title + Connect / Configure Controls */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 lg:flex-row lg:items-start">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0F766E]">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              <span>Sala de Aula Virtual Integrada · Google Classroom</span>
            </div>
            <h2
              id="classroom-showcase-heading"
              className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#0F172A]"
            >
              {showcase.name}
            </h2>
            {showcase.section && (
              <p className="mt-1 text-sm font-medium text-[#475569]">
                {showcase.section}
                {showcase.room ? ` · ${showcase.room}` : ''}
                {showcase.syncedAt ? ` · Sincronizado às ${showcase.syncedAt}` : ''}
              </p>
            )}
            <p className="mt-2.5 text-sm leading-relaxed text-[#334155]">
              {showcase.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isAuthed ? (
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={isLoggingIn}
                className="gsi-material-button inline-flex items-center gap-2.5 rounded-lg border border-[#747775] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="h-4 w-4 shrink-0"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                <span>
                  {isLoggingIn ? 'Conectando...' : 'Carregar minha turma do Google Classroom'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void loadRealCourses()}
                  disabled={loadingCourses || loadingDetails}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#334155] transition hover:border-[#0052A3] hover:text-[#0052A3] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      loadingCourses || loadingDetails ? 'animate-spin text-[#0052A3]' : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span>Sincronizar Turma</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenClassroomModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0052A3] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#003E7E]"
                >
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Gerenciar e Publicar</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setConfigDraft({
                  name: showcase.name,
                  section: showcase.section,
                  description: showcase.description,
                  enrollmentCode: showcase.enrollmentCode,
                  inviteLink: showcase.inviteLink,
                });
                setEditingClassroomConfig((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] transition hover:border-[#0F766E] hover:text-[#0F766E]"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{editingClassroomConfig ? 'Fechar edição' : 'Editar link e código'}</span>
            </button>
          </div>
        </div>

        {/* Live Course Picker when Authenticated with Multiple Courses */}
        {isAuthed && (
          <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-[#BFD7EE] bg-[#F0F7FD] p-3.5 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-2.5 text-xs">
              <span className="font-bold text-[#0052A3]">
                Conectado como {user?.displayName || user?.email}:
              </span>
              {loadingCourses ? (
                <span className="inline-flex items-center gap-1.5 text-[#334155]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0052A3]" />
                  <span>Buscando turmas criadas...</span>
                </span>
              ) : liveCourses.length === 0 ? (
                <span className="text-[#B45309]">
                  Nenhuma turma encontrada nesta conta Google. Crie a turma em classroom.google.com
                  ou informe o link abaixo.
                </span>
              ) : (
                <select
                  aria-label="Selecionar turma do Google Classroom"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="max-w-md rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                >
                  {liveCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.section ? ` — ${c.section}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {liveCourses.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F766E]">
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Turma fixada automaticamente na página inicial</span>
              </div>
            )}
          </div>
        )}

        {/* Feedback Banners */}
        {classroomNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-3.5 py-2.5 text-xs font-medium text-[#166534]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#15803D]" aria-hidden="true" />
            <span>{classroomNotice}</span>
          </div>
        )}

        {classroomError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#991B1B]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#B91C1C]" aria-hidden="true" />
            <span>{classroomError}</span>
          </div>
        )}

        {/* Manual / Custom Public Invite Link & Class Code Editor */}
        {editingClassroomConfig && (
          <form
            onSubmit={handleSaveClassroomConfig}
            className="mt-5 space-y-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0F172A]">
                Configurar Turma e Link de Convite Público
              </h3>
              <span className="text-[11px] text-[#475569]">
                Cole o link de convite e o código da turma do Google Classroom
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B]">
                  Nome da Turma
                </label>
                <input
                  type="text"
                  required
                  value={configDraft.name}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B]">
                  Seção / Disciplina
                </label>
                <input
                  type="text"
                  value={configDraft.section}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, section: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B]">
                  Link de Convite do Google Classroom
                </label>
                <input
                  type="url"
                  value={configDraft.inviteLink}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, inviteLink: e.target.value }))
                  }
                  placeholder="https://classroom.google.com/c/...?cjc=..."
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-xs text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B]">
                  Código da Turma (para participar)
                </label>
                <input
                  type="text"
                  value={configDraft.enrollmentCode}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, enrollmentCode: e.target.value }))
                  }
                  placeholder="Ex.: ab12cd3"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-xs text-[#0F172A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B]">
                Descrição da Turma
              </label>
              <textarea
                rows={2}
                value={configDraft.description}
                onChange={(e) =>
                  setConfigDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white p-2.5 text-xs text-[#0F172A]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingClassroomConfig(false)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#334155]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59]"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Salvar Turma e Link</span>
              </button>
            </div>
          </form>
        )}

        {/* Prominent Join & Enrollment Action Bar */}
        <div className="mt-6 grid grid-cols-1 items-center gap-4 rounded-xl border border-[#99F6E4] bg-[#F0FDFA] p-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="text-xs font-semibold text-[#0F766E]">
              Acesso Aberto para Participantes e Estudantes
            </div>
            <p className="mt-1 text-sm font-bold text-[#0F172A]">
              Entre na turma do projeto no Google Classroom
            </p>
            <p className="mt-1 text-xs text-[#334155]">
              {hasRealJoinLink
                ? 'Clique no botão ao lado para acessar diretamente a sala ou copie o código de inscrição.'
                : 'Conecte sua conta Google acima ou clique em "Editar link e código" para fixar o link de convite da sua turma aqui.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
            <div className="w-full rounded-lg border border-[#99F6E4] bg-white px-3.5 py-2">
              <div className="text-[11px] font-medium text-[#475569]">Código da Turma</div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold tracking-wider tabular-nums text-[#0F172A]">
                  {showcase.enrollmentCode || 'Não definido'}
                </span>
                {showcase.enrollmentCode && (
                  <button
                    type="button"
                    onClick={() => void handleCopyText(showcase.enrollmentCode, 'code')}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-[#0F766E] hover:bg-[#F0FDFA]"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2.5 lg:col-span-4 lg:justify-end">
            <a
              href={directJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#115E59]"
            >
              <span>Entrar na Turma</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => void handleCopyText(directJoinUrl, 'link')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F766E] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F766E] transition hover:bg-[#CCFBF1]/40"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Link copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copiar link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Full Class Telemetry Counters (Topics, CourseWork, Materials, Announcements, Students) */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-medium text-[#475569]">Tópicos</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0F172A]">
              {showcase.topics.length}
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-medium text-[#475569]">Atividades</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0052A3]">
              {showcase.courseWork.length}
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-medium text-[#475569]">Materiais</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0E7490]">
              {showcase.materials.length}
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-medium text-[#475569]">Avisos no Mural</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0F766E]">
              {showcase.announcements.length}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:col-span-1">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#475569]">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Estudantes</span>
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0F172A]">
              {showcase.studentCount}
            </div>
          </div>
        </div>

        {/* Interactive Class Content Tabs ("mostrando tudo") */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#F1F5F9] p-1">
              {(
                [
                  { id: 'tudo', label: 'Tudo da Turma' },
                  { id: 'topicos', label: `Tópicos (${showcase.topics.length})` },
                  { id: 'atividades', label: `Atividades (${showcase.courseWork.length})` },
                  { id: 'materiais', label: `Materiais (${showcase.materials.length})` },
                  { id: 'mural', label: `Mural (${showcase.announcements.length})` },
                ] as { id: ClassroomContentTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveClassTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeClassTab === tab.id
                      ? 'bg-white text-[#0052A3] shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingDetails && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#0052A3]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Atualizando conteúdos da turma...</span>
              </span>
            )}
          </div>

          {/* Tab Content Area */}
          <div className="mt-5">
            {activeClassTab === 'tudo' && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Topics */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                      <FolderOpen className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
                      <span>Tópicos Curriculares ({showcase.topics.length})</span>
                    </h3>
                  </div>
                  {showcase.topics.length === 0 ? (
                    <p className="mt-3 text-xs text-[#64748B]">
                      Nenhum tópico cadastrado ainda nesta turma.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {showcase.topics.map((topic) => (
                        <li
                          key={topic.topicId}
                          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#1E293B]"
                        >
                          {topic.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* CourseWork */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                    <BookOpen className="h-4 w-4 text-[#0052A3]" aria-hidden="true" />
                    <span>Atividades Avaliativas ({showcase.courseWork.length})</span>
                  </h3>
                  {showcase.courseWork.length === 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
                      {isAuthed
                        ? 'Esta turma ainda não possui atividades publicadas. Use "Gerenciar e Publicar" ou os botões nos módulos 3D para criar.'
                        : 'Conecte sua conta Google Classroom acima para exibir em tempo real as atividades publicadas nesta turma.'}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {showcase.courseWork.slice(0, 4).map((cw) => (
                        <li
                          key={cw.id}
                          className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-[#0F172A]">{cw.title}</span>
                            {cw.maxPoints !== undefined && (
                              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[#0052A3]">
                                {cw.maxPoints} pts
                              </span>
                            )}
                          </div>
                          {cw.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-[#475569]">
                              {cw.description}
                            </p>
                          )}
                          {cw.alternateLink && (
                            <a
                              href={cw.alternateLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052A3] hover:underline"
                            >
                              <span>Abrir atividade no Classroom</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Materials */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                    <FolderOpen className="h-4 w-4 text-[#0E7490]" aria-hidden="true" />
                    <span>Materiais de Apoio ({showcase.materials.length})</span>
                  </h3>
                  {showcase.materials.length === 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
                      {isAuthed
                        ? 'Nenhum material de apoio publicado ainda. Você pode publicar scripts R/Python e fichas técnicas diretamente pelo app.'
                        : 'Conecte sua conta Google Classroom para listar todos os materiais de referência compartilhados com a turma.'}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {showcase.materials.slice(0, 4).map((mat) => (
                        <li
                          key={mat.id}
                          className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs"
                        >
                          <div className="font-bold text-[#0F172A]">{mat.title}</div>
                          {mat.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-[#475569]">
                              {mat.description}
                            </p>
                          )}
                          {mat.alternateLink && (
                            <a
                              href={mat.alternateLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0E7490] hover:underline"
                            >
                              <span>Abrir material</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Announcements */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                    <Megaphone className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                    <span>Avisos no Mural ({showcase.announcements.length})</span>
                  </h3>
                  {showcase.announcements.length === 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
                      {isAuthed
                        ? 'Nenhum aviso publicado no mural ainda. Publique boletins da OMS atualizados em tempo real pelo botão Gerenciar.'
                        : 'Conecte sua conta Google Classroom para visualizar os comunicados recentes do mural da turma.'}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {showcase.announcements.slice(0, 4).map((ann) => (
                        <li
                          key={ann.id}
                          className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs"
                        >
                          <p className="line-clamp-3 whitespace-pre-line text-[11px] text-[#1E293B]">
                            {ann.text}
                          </p>
                          {ann.alternateLink && (
                            <a
                              href={ann.alternateLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] hover:underline"
                            >
                              <span>Ver aviso no mural</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeClassTab === 'topicos' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {showcase.topics.length === 0 ? (
                  <p className="text-xs text-[#64748B]">Nenhum tópico encontrado nesta turma.</p>
                ) : (
                  showcase.topics.map((topic) => (
                    <div
                      key={topic.topicId}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#0F172A]"
                    >
                      {topic.name}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeClassTab === 'atividades' && (
              <div className="space-y-3">
                {showcase.courseWork.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    Nenhuma atividade carregada. Conecte sua conta Google Classroom acima para
                    sincronizar todas as tarefas da turma.
                  </p>
                ) : (
                  showcase.courseWork.map((cw) => (
                    <article
                      key={cw.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#0F172A]">{cw.title}</h3>
                        <div className="flex items-center gap-3 text-xs">
                          {cw.maxPoints !== undefined && (
                            <span className="font-mono font-semibold tabular-nums text-[#0052A3]">
                              {cw.maxPoints} pontos
                            </span>
                          )}
                          {cw.alternateLink && (
                            <a
                              href={cw.alternateLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#0052A3] hover:underline"
                            >
                              <span>Abrir no Classroom</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      {cw.description && (
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#334155]">
                          {cw.description}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            )}

            {activeClassTab === 'materiais' && (
              <div className="space-y-3">
                {showcase.materials.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    Nenhum material didático carregado ainda para esta turma.
                  </p>
                ) : (
                  showcase.materials.map((mat) => (
                    <article
                      key={mat.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#0F172A]">{mat.title}</h3>
                        {mat.alternateLink && (
                          <a
                            href={mat.alternateLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7490] hover:underline"
                          >
                            <span>Abrir material</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {mat.description && (
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#334155]">
                          {mat.description}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            )}

            {activeClassTab === 'mural' && (
              <div className="space-y-3">
                {showcase.announcements.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    Nenhum aviso do mural carregado ainda para esta turma.
                  </p>
                ) : (
                  showcase.announcements.map((ann) => (
                    <article
                      key={ann.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                    >
                      <p className="whitespace-pre-line text-xs leading-relaxed text-[#1E293B]">
                        {ann.text}
                      </p>
                      {ann.alternateLink && (
                        <a
                          href={ann.alternateLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                        >
                          <span>Abrir no mural do Google Classroom</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </article>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 4: THE 4 CORE MODULES OF THE PLATFORM */}
      <section aria-labelledby="modules-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#0052A3]">Estrutura da Plataforma</p>
            <h2
              id="modules-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-[#0F172A]"
            >
              Navegue pelas Páginas do Atlas Mpox
            </h2>
            <p className="mt-2 text-sm text-[#475569]">
              Cada módulo foi organizado para estudo autônomo, demonstração em sala de aula e envio
              direto de atividades para a turma no Google Classroom.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenGithubModal}
            className="inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E293B] transition-colors hover:border-[#0052A3] hover:text-[#0052A3]"
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ver Código e Scripts no GitHub</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <article
                key={mod.id}
                className="flex flex-col justify-between rounded-xl border border-[#CBD5E1] bg-white p-6 transition-colors hover:border-[#0052A3]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#475569]">{mod.meta}</span>
                    <Icon className={`h-5 w-5 shrink-0 ${mod.accentColor}`} aria-hidden="true" />
                  </div>
                  <h3 className="mt-2.5 font-display text-lg font-bold text-[#0F172A]">
                    <span className={`mr-1.5 font-mono ${mod.accentColor}`}>{mod.index}</span>
                    {mod.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#334155]">{mod.description}</p>
                </div>

                <div className="mt-5 border-t border-[#E2E8F0] pt-4">
                  <button
                    type="button"
                    onClick={() => onNavigate(mod.id)}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold ${mod.accentColor} hover:underline`}
                  >
                    <span>{mod.cta}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};
