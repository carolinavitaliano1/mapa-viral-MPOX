import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  GraduationCap,
  HelpCircle,
  Loader2,
  LogOut,
  Megaphone,
  RefreshCw,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  ClassroomAnnouncement,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomCourseWorkMaterial,
  ClassroomPostDraft,
  ClassroomStudent,
  ClassroomStudentSubmission,
  ClassroomTopic,
  createClassroomAnnouncement,
  createClassroomCourseWork,
  createClassroomMaterial,
  createCourseTopic,
  listClassroomCourses,
  listCourseAnnouncements,
  listCourseStudents,
  listCourseTopics,
  listCourseWork,
  listCourseWorkMaterials,
  listStudentSubmissions,
  patchStudentSubmissionGrade,
} from '../utils/googleClassroomApi';
import { googleSignIn, initAuth, logout } from '../utils/googleClassroomAuth';
import { LiveMpoxController } from '../hooks/useLiveMpoxData';

interface ClassroomModalProps {
  open: boolean;
  onClose: () => void;
  initialDraft: ClassroomPostDraft | null;
  liveData: LiveMpoxController;
}

type ModalTab = 'publish' | 'coursework' | 'submissions' | 'topics';

interface PendingConfirmAction {
  title: string;
  summary: string;
  details: string[];
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

const EXTENSION_TOPICS = [
  '1. Virologia e Morfologia 3D (MPXV)',
  '2. Epidemiologia Histórica e Clados (1958–2025)',
  '3. Bioestatística em Saúde Pública (R & Python)',
  '4. Vigilância, Farmacoterapia e Prevenção no SUS',
];

export const ClassroomModal: React.FC<ClassroomModalProps> = ({
  open,
  onClose,
  initialDraft,
  liveData,
}) => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [topics, setTopics] = useState<ClassroomTopic[]>([]);
  const [courseWorkList, setCourseWorkList] = useState<ClassroomCourseWork[]>([]);
  const [materialsList, setMaterialsList] = useState<ClassroomCourseWorkMaterial[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<ClassroomAnnouncement[]>([]);
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);

  // Submissions & Grading state
  const [selectedCourseWorkId, setSelectedCourseWorkId] = useState<string>('');
  const [submissions, setSubmissions] = useState<ClassroomStudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});

  // Active tab
  const [activeTab, setActiveTab] = useState<ModalTab>('publish');

  // Form state for publishing
  const [postKind, setPostKind] = useState<'assignment' | 'question' | 'material' | 'announcement'>(
    'assignment'
  );
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postMaxPoints, setPostMaxPoints] = useState<number>(100);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [attachAppLink, setAttachAppLink] = useState<boolean>(true);
  const [sourceBadge, setSourceBadge] = useState<string>('Projeto de Extensão · Farmácia SUS');

  // Status & confirmation modal state
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    link?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmAction | null>(null);

  // Initialize Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Populate draft whenever initialDraft changes or modal opens
  useEffect(() => {
    if (!open) return;
    setStatusMessage(null);
    if (initialDraft) {
      setActiveTab('publish');
      setPostKind(initialDraft.kind);
      setPostTitle(initialDraft.title);
      setPostDescription(initialDraft.description);
      if (typeof initialDraft.maxPoints === 'number') {
        setPostMaxPoints(initialDraft.maxPoints);
      }
      if (initialDraft.sourceBadge) {
        setSourceBadge(initialDraft.sourceBadge);
      }
    } else if (!postTitle) {
      const snap = liveData.snapshot;
      const globalCases = snap ? snap.global.totalCases.toLocaleString('pt-BR') : '100.000+';
      const brCases = snap ? snap.brazil.totalCases.toLocaleString('pt-BR') : '12.000+';
      setPostKind('assignment');
      setPostTitle('Estudo de Caso: Vigilância Epidemiológica e Morfologia 3D do Vírus Mpox');
      setPostDescription(
        `Atividade prática do Projeto de Extensão Universitária em Farmácia (Atlas Mpox · SUS).\n\n` +
          `Panorama Epidemiológico Atual (OMS):\n` +
          `• Casos confirmados globalmente: ${globalCases}\n` +
          `• Casos confirmados no Brasil: ${brCases}\n\n` +
          `Roteiro da Atividade:\n` +
          `1. Acesse o Mapa 3D e compare a transição epidemiológica entre o Clado I (Bacia do Congo) e o Clado IIb (Surto Global 2022).\n` +
          `2. No modelo 3D do Vírus Mpox, inspecione a Membrana Externa e explique o mecanismo farmacológico do antiviral Tecovirimat (inibidor da proteína VP37).\n` +
          `3. Descreva o fluxo de triagem farmacêutica, coleta de swab de lesão para qPCR e isolamento domiciliar no SUS.`
      );
      setPostMaxPoints(100);
      setSourceBadge('Roteiro Integrado · Extensão em Farmácia');
    }
  }, [open, initialDraft]);

  // Load courses when authenticated and modal is open
  useEffect(() => {
    if (open && !needsAuth) {
      void fetchCourses();
    }
  }, [open, needsAuth]);

  // Load selected course details when selectedCourseId changes
  useEffect(() => {
    if (open && !needsAuth && selectedCourseId) {
      void fetchCourseDetails(selectedCourseId);
    }
  }, [open, needsAuth, selectedCourseId]);

  // Auto-match topic if initialDraft has topicName
  useEffect(() => {
    if (initialDraft?.topicName && topics.length > 0) {
      const found = topics.find((t) =>
        t.name.toLowerCase().includes(initialDraft.topicName!.toLowerCase().slice(0, 14))
      );
      if (found) {
        setSelectedTopicId(found.topicId);
      }
    }
  }, [initialDraft, topics]);

  // Load submissions when selectedCourseWorkId changes
  useEffect(() => {
    if (open && !needsAuth && selectedCourseId && selectedCourseWorkId) {
      void fetchSubmissions(selectedCourseId, selectedCourseWorkId);
    }
  }, [open, needsAuth, selectedCourseId, selectedCourseWorkId]);

  const handleAuthError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'AUTH_REQUIRED') {
      setNeedsAuth(true);
      setAuthError('Sua sessão expirou. Conecte-se novamente com o Google.');
    } else {
      setStatusMessage({ type: 'error', text: msg });
    }
  };

  const fetchCourses = async () => {
    setLoadingCourses(true);
    setStatusMessage(null);
    try {
      const list = await listClassroomCourses();
      setCourses(list);
      if (list.length > 0 && (!selectedCourseId || !list.some((c) => c.id === selectedCourseId))) {
        setSelectedCourseId(list[0].id);
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchCourseDetails = async (courseId: string) => {
    setLoadingCourseDetails(true);
    try {
      const [tList, cwList, matList, annList, stuList] = await Promise.all([
        listCourseTopics(courseId),
        listCourseWork(courseId),
        listCourseWorkMaterials(courseId),
        listCourseAnnouncements(courseId),
        listCourseStudents(courseId),
      ]);
      setTopics(tList);
      setCourseWorkList(cwList);
      setMaterialsList(matList);
      setAnnouncementsList(annList);
      setStudents(stuList);

      if (cwList.length > 0) {
        setSelectedCourseWorkId((prev) =>
          prev && cwList.some((cw) => cw.id === prev) ? prev : cwList[0].id
        );
      } else {
        setSelectedCourseWorkId('');
        setSubmissions([]);
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoadingCourseDetails(false);
    }
  };

  const fetchSubmissions = async (courseId: string, courseWorkId: string) => {
    setLoadingSubmissions(true);
    try {
      const subs = await listStudentSubmissions(courseId, courseWorkId);
      setSubmissions(subs);
      const nextInputs: Record<string, string> = {};
      for (const s of subs) {
        const val = s.assignedGrade ?? s.draftGrade;
        if (val !== undefined) {
          nextInputs[s.id] = String(val);
        }
      }
      setGradeInputs(nextInputs);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao autenticar com o Google Classroom.';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setCourses([]);
    setSelectedCourseId('');
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  // Prepare explicit confirmation before publishing to Google Classroom
  const handleRequestPublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    const kindLabels: Record<typeof postKind, string> = {
      assignment: 'Atividade Avaliativa (CourseWork)',
      question: 'Questão Discursiva (Short Answer Question)',
      material: 'Material Didático de Apoio (CourseWorkMaterial)',
      announcement: 'Comunicado no Mural da Turma (Announcement)',
    };

    const selectedTopic = topics.find((t) => t.topicId === selectedTopicId);
    const appOrigin =
      typeof window !== 'undefined' && /^https?:\/\//i.test(window.location.origin)
        ? window.location.origin
        : undefined;

    const details: string[] = [
      `Turma de destino: ${selectedCourse.name}${selectedCourse.section ? ` (${selectedCourse.section})` : ''}`,
      `Formato: ${kindLabels[postKind]}`,
    ];
    if (postKind !== 'announcement') {
      details.push(`Título: ${postTitle.trim()}`);
    }
    if (selectedTopic && postKind !== 'announcement') {
      details.push(`Tópico: ${selectedTopic.name}`);
    }
    if ((postKind === 'assignment' || postKind === 'question') && postMaxPoints > 0) {
      details.push(`Pontuação máxima: ${postMaxPoints} pontos`);
    }

    setPendingConfirmation({
      title: 'Confirmar Publicação no Google Classroom',
      summary:
        'Esta ação criará e publicará um novo item diretamente na turma selecionada do Google Classroom.',
      details,
      confirmLabel: 'Confirmar e Publicar na Turma',
      onConfirm: async () => {
        setSubmitting(true);
        setStatusMessage(null);
        try {
          if (postKind === 'assignment' || postKind === 'question') {
            const created = await createClassroomCourseWork(selectedCourse.id, {
              title: postTitle.trim(),
              description: postDescription.trim(),
              workType: postKind === 'assignment' ? 'ASSIGNMENT' : 'SHORT_ANSWER_QUESTION',
              maxPoints: postMaxPoints,
              topicId: selectedTopicId || undefined,
              linkUrl: attachAppLink ? appOrigin : undefined,
              linkTitle: 'Atlas Mpox · SUS — Laboratório 3D e Vigilância',
            });
            setStatusMessage({
              type: 'success',
              text: `Atividade "${created.title}" publicada com sucesso na turma ${selectedCourse.name}!`,
              link: created.alternateLink,
            });
          } else if (postKind === 'material') {
            const created = await createClassroomMaterial(selectedCourse.id, {
              title: postTitle.trim(),
              description: postDescription.trim(),
              topicId: selectedTopicId || undefined,
              linkUrl: attachAppLink ? appOrigin : undefined,
              linkTitle: 'Atlas Mpox · SUS — Material de Referência',
            });
            setStatusMessage({
              type: 'success',
              text: `Material "${created.title}" publicado com sucesso na turma ${selectedCourse.name}!`,
              link: created.alternateLink,
            });
          } else {
            const fullText = postTitle.trim()
              ? `${postTitle.trim()}\n\n${postDescription.trim()}`
              : postDescription.trim();
            const created = await createClassroomAnnouncement(selectedCourse.id, {
              text: fullText,
              linkUrl: attachAppLink ? appOrigin : undefined,
              linkTitle: 'Atlas Mpox · SUS — Boletim em Tempo Real',
            });
            setStatusMessage({
              type: 'success',
              text: `Comunicado publicado no mural da turma ${selectedCourse.name}!`,
              link: created.alternateLink,
            });
          }
          await fetchCourseDetails(selectedCourse.id);
        } catch (err) {
          handleAuthError(err);
        } finally {
          setSubmitting(false);
          setPendingConfirmation(null);
        }
      },
    });
  };

  // Prepare explicit confirmation before creating the 4 standard Pharmacy Extension topics
  const handleRequestCreateStandardTopics = () => {
    if (!selectedCourse) return;
    const existingNames = new Set(topics.map((t) => t.name.trim().toLowerCase()));
    const missing = EXTENSION_TOPICS.filter((name) => !existingNames.has(name.toLowerCase()));

    if (missing.length === 0) {
      setStatusMessage({
        type: 'success',
        text: 'Todos os 4 tópicos curriculares da Extensão em Farmácia já estão criados nesta turma.',
      });
      return;
    }

    setPendingConfirmation({
      title: 'Confirmar Criação de Tópicos Curriculares',
      summary: `Serão criados ${missing.length} tópico(s) organizacionais na turma "${selectedCourse.name}".`,
      details: missing.map((m) => `Novo tópico: ${m}`),
      confirmLabel: `Criar ${missing.length} Tópico(s)`,
      onConfirm: async () => {
        setSubmitting(true);
        setStatusMessage(null);
        try {
          for (const topicName of missing) {
            await createCourseTopic(selectedCourse.id, topicName);
          }
          await fetchCourseDetails(selectedCourse.id);
          setStatusMessage({
            type: 'success',
            text: `${missing.length} tópico(s) do Projeto de Extensão criados com sucesso!`,
          });
        } catch (err) {
          handleAuthError(err);
        } finally {
          setSubmitting(false);
          setPendingConfirmation(null);
        }
      },
    });
  };

  // Prepare explicit confirmation before updating a student's grade
  const handleRequestSaveGrade = (
    sub: ClassroomStudentSubmission,
    studentName: string,
    asFinal: boolean
  ) => {
    if (!selectedCourse || !selectedCourseWorkId) return;
    const rawVal = gradeInputs[sub.id];
    const numericGrade = Number(rawVal);
    if (!Number.isFinite(numericGrade) || numericGrade < 0) {
      setStatusMessage({
        type: 'error',
        text: 'Informe um valor numérico válido para a nota.',
      });
      return;
    }

    const activeCw = courseWorkList.find((cw) => cw.id === selectedCourseWorkId);

    setPendingConfirmation({
      title: asFinal
        ? 'Confirmar Lançamento de Nota Definitiva'
        : 'Confirmar Salvamento de Nota Rascunho',
      summary: `Você está prestes a atualizar a avaliação do estudante no Google Classroom.`,
      details: [
        `Turma: ${selectedCourse.name}`,
        `Atividade: ${activeCw?.title ?? selectedCourseWorkId}`,
        `Estudante: ${studentName}`,
        `Nota a registrar: ${numericGrade}${activeCw?.maxPoints ? ` / ${activeCw.maxPoints}` : ''}`,
        `Tipo de registro: ${asFinal ? 'Nota atribuída + rascunho' : 'Apenas rascunho (draftGrade)'}`,
      ],
      confirmLabel: asFinal ? 'Confirmar Nota Final' : 'Salvar Rascunho',
      onConfirm: async () => {
        setSubmitting(true);
        setStatusMessage(null);
        try {
          await patchStudentSubmissionGrade(
            selectedCourse.id,
            selectedCourseWorkId,
            sub.id,
            numericGrade,
            asFinal ? numericGrade : undefined
          );
          await fetchSubmissions(selectedCourse.id, selectedCourseWorkId);
          setStatusMessage({
            type: 'success',
            text: `Nota de ${studentName} (${numericGrade}) atualizada no Google Classroom!`,
          });
        } catch (err) {
          handleAuthError(err);
        } finally {
          setSubmitting(false);
          setPendingConfirmation(null);
        }
      },
    });
  };

  const applyQuickTemplate = (templateId: 'live_bulletin' | 'virus_3d' | 'r_python' | 'sus_flow') => {
    const snap = liveData.snapshot;
    const globalCases = snap ? snap.global.totalCases.toLocaleString('pt-BR') : '100.000+';
    const globalDeaths = snap ? snap.global.totalDeaths.toLocaleString('pt-BR') : '220+';
    const brCases = snap ? snap.brazil.totalCases.toLocaleString('pt-BR') : '12.000+';
    const brFatality = snap ? `${snap.brazil.fatalityPct.toFixed(2)}%` : '0,14%';

    if (templateId === 'live_bulletin') {
      setPostKind('announcement');
      setPostTitle('Boletim Epidemiológico Mpox — Atualização OMS / SUS');
      setPostDescription(
        `Prezada turma,\n\n` +
          `Seguem os indicadores atualizados da vigilância epidemiológica da Mpox (Fonte: OMS / Our World in Data no Atlas Mpox · SUS):\n` +
          `• Casos confirmados no mundo: ${globalCases} (${globalDeaths} óbitos)\n` +
          `• Casos confirmados no Brasil: ${brCases} (Letalidade: ${brFatality})\n\n` +
          `Acessem o Globo 3D e o painel de Bioestatística para revisar a distribuição por UF e a curva mensal.`
      );
      setSourceBadge('Boletim em Tempo Real OMS');
    } else if (templateId === 'virus_3d') {
      setPostKind('assignment');
      setPostTitle('Prática 3D: Morfologia do Orthopoxvirus (MPXV) e Alvos Antivirais');
      setPostDescription(
        `Utilizando o visualizador 3D em corte transversal do Vírus Mpox (MPXV):\n\n` +
          `1. Ative a "Vista Explodida" e descreva a organização espacial entre a Membrana Externa, Túbulos de Superfície, Corpos Laterais, Camada Paliçada e Núcleo Bicôncavo.\n` +
          `2. Explique por que o genoma dsDNA linear (~197 kb) permite replicação exclusivamente citoplasmática.\n` +
          `3. Relacione o envelope lipoproteico externo com a ação do antiviral Tecovirimat (ST-246 / VP37) e com a eficácia de antissépticos padronizados no SUS.`
      );
      setPostMaxPoints(100);
      setSourceBadge('Virologia 3D · Farmácia');
    } else if (templateId === 'r_python') {
      setPostKind('material');
      setPostTitle('Material Prático: Scripts de Bioestatística Mpox em R (ggplot2) e Python (pandas)');
      setPostDescription(
        `Roteiro reprodutível para análise de séries temporais da Mpox, cálculo de média móvel de 7 dias, incidência por milhão de habitantes e taxa de letalidade utilizando dados abertos da OMS e SINAN/SUS.`
      );
      setSourceBadge('Bioestatística R & Python');
    } else if (templateId === 'sus_flow') {
      setPostKind('question');
      setPostTitle('Discussão Clínica: Acolhimento Farmacêutico e Diagnóstico qPCR no SUS');
      setPostDescription(
        `Diante de um paciente com exantema papulovesicular agudo, linfadenopatia cervical e febre há 3 dias que procura orientação na farmácia comunitária ou UBS:\n\n` +
          `Qual deve ser a conduta farmacêutica imediata quanto à biossegurança, notificação suspeita, encaminhamento para coleta de swab de lesão (qPCR) e manejo sintomático seguro (evitando AINEs em lesões ulceradas graves)?`
      );
      setPostMaxPoints(10);
      setSourceBadge('Assistência Farmacêutica SUS');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="classroom-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-xs">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="classroom-modal-title"
                  className="font-display text-base font-bold text-[#0F172A] sm:text-lg"
                >
                  Google Classroom · Extensão Universitária em Farmácia
                </h2>
                <span className="hidden rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#0F766E] sm:inline-block">
                  API Oficial v1
                </span>
              </div>
              <p className="text-xs text-[#475569]">
                Publique estudos de caso 3D, roteiros R/Python, boletins OMS e acompanhe entregas da
                sua turma
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!needsAuth && user && (
              <div className="hidden items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs sm:flex">
                <span className="font-semibold text-[#0F172A]">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Desconectar conta Google"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#C81E3A] hover:bg-[#FEF2F2]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sair</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              aria-label="Fechar central do Google Classroom"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {needsAuth ? (
            /* Sign-in Screen with Official Google Material Button */
            <div className="mx-auto my-6 max-w-xl rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F0FA] text-[#0052A3]">
                <GraduationCap className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A]">
                Conecte sua conta do Google Classroom
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Faça login com sua conta Google institucional ou acadêmica para listar suas
                disciplinas, publicar estudos de caso diretamente do Globo 3D e do Vírus 3D, criar
                tópicos da Extensão em Farmácia e avaliar entregas dos estudantes.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2.5 text-left text-xs text-[#334155] sm:grid-cols-2">
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                  <span className="font-bold text-[#0052A3]">• Publicação com 1 clique</span>
                  <p className="mt-0.5 text-[#475569]">
                    Transforme qualquer marco histórico ou estrutura viral 3D em atividade avaliativa.
                  </p>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                  <span className="font-bold text-[#0F766E]">• Boletins OMS em tempo real</span>
                  <p className="mt-0.5 text-[#475569]">
                    Compartilhe dados atualizados da OMS e scripts R/Python no mural da turma.
                  </p>
                </div>
              </div>

              {authError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-left text-xs text-[#991B1B]">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="gsi-material-button inline-flex items-center gap-3 rounded-lg border border-[#747775] bg-white px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] shadow-xs transition hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  <div className="gsi-material-button-icon h-5 w-5 shrink-0">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="block h-5 w-5"
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
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Conectando ao Google...' : 'Sign in with Google'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Authenticated Classroom Workspace */
            <div className="space-y-5">
              {/* Top Course Selector Bar */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3.5 sm:flex-row sm:items-center">
                <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <label
                    htmlFor="classroom-course-select"
                    className="text-xs font-bold uppercase tracking-wider text-[#0052A3] whitespace-nowrap"
                  >
                    Turma Ativa:
                  </label>
                  {loadingCourses ? (
                    <div className="inline-flex items-center gap-2 text-xs text-[#475569]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#0052A3]" />
                      <span>Carregando turmas do Google Classroom...</span>
                    </div>
                  ) : courses.length === 0 ? (
                    <span className="text-xs font-medium text-[#B45309]">
                      Nenhuma turma encontrada na sua conta Google Classroom. Crie uma turma em
                      classroom.google.com e clique em Atualizar.
                    </span>
                  ) : (
                    <select
                      id="classroom-course-select"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full max-w-md rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                          {course.section ? ` — ${course.section}` : ''}
                          {course.courseState && course.courseState !== 'ACTIVE'
                            ? ` [${course.courseState}]`
                            : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedCourse?.alternateLink && (
                    <a
                      href={selectedCourse.alternateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0052A3] transition hover:border-[#0052A3] hover:bg-[#E6F0FA]"
                    >
                      <span>Abrir no Classroom</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void fetchCourses();
                      if (selectedCourseId) void fetchCourseDetails(selectedCourseId);
                    }}
                    disabled={loadingCourses || loadingCourseDetails}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:border-[#0052A3] hover:text-[#0052A3] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        loadingCourses || loadingCourseDetails ? 'animate-spin text-[#0052A3]' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs ${
                    statusMessage.type === 'success'
                      ? 'border-[#86EFAC] bg-[#F0FDF4] text-[#166534]'
                      : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#15803D]" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-[#B91C1C]" />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                  {statusMessage.link && (
                    <a
                      href={statusMessage.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold underline"
                    >
                      <span>Ver publicação no Google Classroom</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0] pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('publish')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    activeTab === 'publish'
                      ? 'bg-[#0052A3] text-white'
                      : 'bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Publicar Atividade / Material / Aviso</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('coursework')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    activeTab === 'coursework'
                      ? 'bg-[#0052A3] text-white'
                      : 'bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Mural & Atividades da Turma (
                    {courseWorkList.length + materialsList.length + announcementsList.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('submissions')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    activeTab === 'submissions'
                      ? 'bg-[#0052A3] text-white'
                      : 'bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Entregas & Notas ({students.length} alunos)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('topics')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    activeTab === 'topics'
                      ? 'bg-[#0052A3] text-white'
                      : 'bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tópicos Curriculares ({topics.length})</span>
                </button>
              </div>

              {/* TAB 1: PUBLISH */}
              {activeTab === 'publish' && (
                <div className="grid gap-5 lg:grid-cols-12">
                  {/* Form column */}
                  <form
                    onSubmit={handleRequestPublish}
                    className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4 lg:col-span-8"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                        Configurar Publicação Pedagógica
                      </span>
                      <span className="rounded-md border border-[#BFD7EE] bg-[#F0F7FD] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#0052A3]">
                        Origem: {sourceBadge}
                      </span>
                    </div>

                    {/* Type selector */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        {
                          id: 'assignment',
                          label: 'Atividade (Tarefa)',
                          icon: BookOpen,
                        },
                        {
                          id: 'question',
                          label: 'Questão Discursiva',
                          icon: HelpCircle,
                        },
                        {
                          id: 'material',
                          label: 'Material Didático',
                          icon: FolderPlus,
                        },
                        {
                          id: 'announcement',
                          label: 'Aviso no Mural',
                          icon: Megaphone,
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        const active = postKind === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPostKind(item.id as typeof postKind)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                              active
                                ? 'border-[#0052A3] bg-[#E6F0FA] text-[#0052A3]'
                                : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155] hover:bg-white'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B]">
                        {postKind === 'announcement'
                          ? 'Título do Comunicado (opcional)'
                          : 'Título da Atividade / Material *'}
                      </label>
                      <input
                        type="text"
                        required={postKind !== 'announcement'}
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                        placeholder="Ex.: Estudo de Caso: Morfologia 3D do Vírus Mpox e Antivirais"
                        className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B]">
                        Roteiro Pedagógico / Instruções para o Estudante *
                      </label>
                      <textarea
                        rows={7}
                        required
                        value={postDescription}
                        onChange={(e) => setPostDescription(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white p-3 font-sans text-xs leading-relaxed text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                      />
                    </div>

                    {postKind !== 'announcement' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-[#1E293B]">
                            Tópico na Disciplina
                          </label>
                          <select
                            value={selectedTopicId}
                            onChange={(e) => setSelectedTopicId(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                          >
                            <option value="">Sem tópico específico</option>
                            {topics.map((t) => (
                              <option key={t.topicId} value={t.topicId}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {(postKind === 'assignment' || postKind === 'question') && (
                          <div>
                            <label className="block text-xs font-semibold text-[#1E293B]">
                              Pontuação Máxima
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              value={postMaxPoints}
                              onChange={(e) => setPostMaxPoints(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] focus:border-[#0052A3] focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
                      <label className="inline-flex items-center gap-2 text-xs text-[#334155]">
                        <input
                          type="checkbox"
                          checked={attachAppLink}
                          onChange={(e) => setAttachAppLink(e.target.checked)}
                          className="rounded border-[#CBD5E1] text-[#0052A3]"
                        />
                        <span>Anexar link interativo do Atlas Mpox · SUS na postagem</span>
                      </label>

                      <button
                        type="submit"
                        disabled={!selectedCourse || submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#115E59] disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Revisar e Publicar no Classroom</span>
                      </button>
                    </div>
                  </form>

                  {/* Quick pedagogical templates column */}
                  <div className="space-y-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 lg:col-span-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0052A3]">
                      Modelos Prontos de Extensão
                    </h3>
                    <p className="text-xs text-[#475569]">
                      Carregue um roteiro estruturado com dados reais da OMS e objetivos de
                      aprendizagem em Farmácia:
                    </p>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => applyQuickTemplate('virus_3d')}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white p-3 text-left transition hover:border-[#0052A3] hover:bg-[#F0F7FD]"
                      >
                        <div className="text-xs font-bold text-[#0F172A]">
                          1. Prática 3D: Anatomia Viral & Tecovirimat
                        </div>
                        <p className="mt-1 text-[11px] text-[#475569]">
                          Tarefa avaliativa sobre as 7 estruturas 3D do MPXV, envelope VP37 e
                          replicação citoplasmática.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyQuickTemplate('live_bulletin')}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white p-3 text-left transition hover:border-[#0052A3] hover:bg-[#F0F7FD]"
                      >
                        <div className="text-xs font-bold text-[#0F172A]">
                          2. Boletim OMS em Tempo Real no Mural
                        </div>
                        <p className="mt-1 text-[11px] text-[#475569]">
                          Publica no mural os números sincronizados agora da OMS (Mundo e Brasil).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyQuickTemplate('r_python')}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white p-3 text-left transition hover:border-[#0052A3] hover:bg-[#F0F7FD]"
                      >
                        <div className="text-xs font-bold text-[#0F172A]">
                          3. Material: Scripts R (ggplot2) & Python
                        </div>
                        <p className="mt-1 text-[11px] text-[#475569]">
                          Envia guia de bioestatística reprodutível como material de referência da
                          disciplina.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyQuickTemplate('sus_flow')}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white p-3 text-left transition hover:border-[#0052A3] hover:bg-[#F0F7FD]"
                      >
                        <div className="text-xs font-bold text-[#0F172A]">
                          4. Questão Rápida: Triagem e qPCR no SUS
                        </div>
                        <p className="mt-1 text-[11px] text-[#475569]">
                          Pergunta discursiva sobre acolhimento farmacêutico, coleta de swab e manejo
                          da dor.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COURSEWORK, MATERIALS & ANNOUNCEMENTS */}
              {activeTab === 'coursework' && (
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* CourseWork column */}
                  <div className="rounded-xl border border-[#CBD5E1] bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0052A3]">
                      Atividades & Questões ({courseWorkList.length})
                    </h3>
                    {courseWorkList.length === 0 ? (
                      <p className="mt-3 text-xs text-[#64748B]">
                        Nenhuma atividade publicada nesta turma ainda.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2.5">
                        {courseWorkList.map((cw) => (
                          <li
                            key={cw.id}
                            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-[#0F172A]">{cw.title}</span>
                              {cw.maxPoints !== undefined && (
                                <span className="shrink-0 rounded bg-[#E6F0FA] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#0052A3]">
                                  {cw.maxPoints} pts
                                </span>
                              )}
                            </div>
                            {cw.description && (
                              <p className="mt-1 line-clamp-2 text-[11px] text-[#475569]">
                                {cw.description}
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCourseWorkId(cw.id);
                                  setActiveTab('submissions');
                                }}
                                className="text-[11px] font-semibold text-[#0F766E] hover:underline"
                              >
                                Ver entregas dos alunos →
                              </button>
                              {cw.alternateLink && (
                                <a
                                  href={cw.alternateLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052A3] hover:underline"
                                >
                                  <span>Abrir</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Materials column */}
                  <div className="rounded-xl border border-[#CBD5E1] bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E7490]">
                      Materiais Didáticos ({materialsList.length})
                    </h3>
                    {materialsList.length === 0 ? (
                      <p className="mt-3 text-xs text-[#64748B]">
                        Nenhum material de referência publicado ainda.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2.5">
                        {materialsList.map((mat) => (
                          <li
                            key={mat.id}
                            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs"
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
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052A3] hover:underline"
                              >
                                <span>Abrir no Classroom</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Announcements column */}
                  <div className="rounded-xl border border-[#CBD5E1] bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                      Mural da Turma ({announcementsList.length})
                    </h3>
                    {announcementsList.length === 0 ? (
                      <p className="mt-3 text-xs text-[#64748B]">
                        Nenhum aviso publicado no mural desta turma.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2.5">
                        {announcementsList.map((ann) => (
                          <li
                            key={ann.id}
                            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs"
                          >
                            <p className="line-clamp-3 whitespace-pre-line text-[11px] text-[#1E293B]">
                              {ann.text}
                            </p>
                            {ann.alternateLink && (
                              <a
                                href={ann.alternateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052A3] hover:underline"
                              >
                                <span>Ver no mural</span>
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

              {/* TAB 3: STUDENT SUBMISSIONS & GRADING */}
              {activeTab === 'submissions' && (
                <div className="space-y-4 rounded-xl border border-[#CBD5E1] bg-white p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0052A3]">
                        Acompanhamento de Entregas e Avaliação
                      </h3>
                      <p className="text-xs text-[#475569]">
                        Selecione uma atividade para consultar respostas e atribuir notas com
                        confirmação segura
                      </p>
                    </div>

                    {courseWorkList.length > 0 && (
                      <select
                        value={selectedCourseWorkId}
                        onChange={(e) => setSelectedCourseWorkId(e.target.value)}
                        className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#0F172A]"
                      >
                        {courseWorkList.map((cw) => (
                          <option key={cw.id} value={cw.id}>
                            {cw.title} ({cw.maxPoints ?? 100} pts)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {courseWorkList.length === 0 ? (
                    <p className="text-xs text-[#64748B]">
                      Publique uma atividade primeiro para acompanhar as entregas dos estudantes.
                    </p>
                  ) : loadingSubmissions ? (
                    <div className="flex items-center gap-2 py-6 text-xs text-[#475569]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#0052A3]" />
                      <span>Carregando entregas dos estudantes...</span>
                    </div>
                  ) : submissions.length === 0 ? (
                    <p className="py-4 text-xs text-[#64748B]">
                      Nenhuma submissão encontrada para esta atividade.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#475569]">
                            <th className="px-3 py-2.5">Estudante</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Resposta / Anexo</th>
                            <th className="px-3 py-2.5">Nota</th>
                            <th className="px-3 py-2.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {submissions.map((sub) => {
                            const studentObj = students.find((s) => s.userId === sub.userId);
                            const studentName =
                              studentObj?.profile?.name?.fullName ||
                              studentObj?.profile?.emailAddress ||
                              `Estudante (${sub.userId.slice(0, 8)})`;

                            return (
                              <tr key={sub.id} className="hover:bg-[#F8FAFC]">
                                <td className="px-3 py-2.5 font-semibold text-[#0F172A]">
                                  {studentName}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                      sub.state === 'TURNED_IN'
                                        ? 'bg-[#DCFCE7] text-[#166534]'
                                        : sub.state === 'RETURNED'
                                          ? 'bg-[#E6F0FA] text-[#0052A3]'
                                          : 'bg-[#F1F5F9] text-[#475569]'
                                    }`}
                                  >
                                    {sub.state || 'CREATED'}
                                  </span>
                                </td>
                                <td className="max-w-xs px-3 py-2.5 text-[#334155]">
                                  {sub.shortAnswerSubmission?.answer ? (
                                    <p className="line-clamp-2 text-[11px]">
                                      {sub.shortAnswerSubmission.answer}
                                    </p>
                                  ) : sub.alternateLink ? (
                                    <a
                                      href={sub.alternateLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052A3] hover:underline"
                                    >
                                      <span>Inspecionar entrega</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="text-[#94A3B8]">Sem texto direto</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={1000}
                                    value={gradeInputs[sub.id] ?? ''}
                                    onChange={(e) =>
                                      setGradeInputs((prev) => ({
                                        ...prev,
                                        [sub.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Nota"
                                    className="w-20 rounded border border-[#CBD5E1] bg-white px-2 py-1 font-mono text-xs text-[#0F172A]"
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleRequestSaveGrade(sub, studentName, false)}
                                      className="rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#334155] hover:border-[#0052A3] hover:text-[#0052A3]"
                                    >
                                      Rascunho
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRequestSaveGrade(sub, studentName, true)}
                                      className="rounded bg-[#0052A3] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#003E7E]"
                                    >
                                      Atribuir Nota
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CURRICULAR TOPICS */}
              {activeTab === 'topics' && (
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="space-y-3 rounded-xl border border-[#CBD5E1] bg-white p-4 lg:col-span-7">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0052A3]">
                      Tópicos Atuais na Turma ({topics.length})
                    </h3>
                    {topics.length === 0 ? (
                      <p className="text-xs text-[#64748B]">
                        Esta turma ainda não possui tópicos cadastrados. Utilize o botão ao lado
                        para gerar a estrutura curricular do Projeto de Extensão em Farmácia.
                      </p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {topics.map((t) => (
                          <li
                            key={t.topicId}
                            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-[#0F172A]"
                          >
                            {t.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-[#BFD7EE] bg-[#F0F7FD] p-4 lg:col-span-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0052A3]">
                      Estrutura Curricular Recomendada (Farmácia / SUS)
                    </h3>
                    <p className="text-xs leading-relaxed text-[#1E3A5F]">
                      Organize automaticamente a aba &ldquo;Atividades&rdquo; do Google Classroom
                      com os 4 eixos do Atlas Mpox:
                    </p>
                    <ul className="space-y-1.5 text-xs font-medium text-[#0F172A]">
                      {EXTENSION_TOPICS.map((name) => (
                        <li key={name} className="rounded-lg bg-white/80 px-3 py-1.5">
                          {name}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={handleRequestCreateStandardTopics}
                      disabled={!selectedCourse || submitting}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0052A3] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#003E7E] disabled:opacity-50"
                    >
                      <FolderPlus className="h-4 w-4" aria-hidden="true" />
                      <span>Criar Tópicos da Extensão na Turma</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Explicit User Confirmation Dialog for Mutating Operations */}
        {pendingConfirmation && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-2xl">
              <h3
                id="confirm-action-title"
                className="font-display text-base font-bold text-[#0F172A]"
              >
                {pendingConfirmation.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                {pendingConfirmation.summary}
              </p>

              <ul className="mt-3 space-y-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#1E293B]">
                {pendingConfirmation.details.map((item, idx) => (
                  <li key={idx} className="font-medium">
                    • {item}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPendingConfirmation(null)}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void pendingConfirmation.onConfirm()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{pendingConfirmation.confirmLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
