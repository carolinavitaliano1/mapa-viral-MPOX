import { useEffect, useState } from 'react';
import { BiostatisticsView } from './components/BiostatisticsView';
import { ClassroomModal } from './components/ClassroomModal';
import { GithubModal } from './components/GithubModal';
import { GlobeView } from './components/GlobeView';
import { HomeView } from './components/HomeView';
import { PreventionView } from './components/PreventionView';
import { ActiveSection, TopNav } from './components/TopNav';
import { VirusView } from './components/VirusView';
import { DEFAULT_GITHUB_URL } from './data/mpoxTimeline';
import { useLiveMpoxData } from './hooks/useLiveMpoxData';
import { ClassroomPostDraft } from './utils/googleClassroomApi';
import { initAuth, isClassroomOwner } from './utils/googleClassroomAuth';

const GITHUB_STORAGE_KEY = 'atlas_mpox_sus_github_url';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('inicio');
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [classroomModalOpen, setClassroomModalOpen] = useState(false);
  const [classroomDraft, setClassroomDraft] = useState<ClassroomPostDraft | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const liveData = useLiveMpoxData();
  const [githubUrl, setGithubUrl] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem(GITHUB_STORAGE_KEY);
      return saved && /^https?:\/\/.+/i.test(saved) ? saved : DEFAULT_GITHUB_URL;
    } catch {
      return DEFAULT_GITHUB_URL;
    }
  });

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setIsOwner(isClassroomOwner(authedUser));
      },
      () => {
        setIsOwner(false);
        setClassroomModalOpen(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GITHUB_STORAGE_KEY, githubUrl);
    } catch {
      // Ignore storage restrictions
    }
  }, [githubUrl]);

  const handleChangeSection = (section: ActiveSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenClassroomWithDraft = (draft?: ClassroomPostDraft) => {
    if (!isOwner) return;
    setClassroomDraft(draft ?? null);
    setClassroomModalOpen(true);
  };

  const ownerShareHandler = isOwner
    ? (draft: ClassroomPostDraft) => handleOpenClassroomWithDraft(draft)
    : undefined;

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-[#0F172A]">
      <TopNav
        activeSection={activeSection}
        isOwner={isOwner}
        onChangeSection={handleChangeSection}
        onOpenGithubModal={() => setGithubModalOpen(true)}
        onOpenClassroomModal={() => handleOpenClassroomWithDraft()}
      />

      {activeSection === 'inicio' && (
        <>
          <HomeView
            liveData={liveData}
            onNavigate={handleChangeSection}
            onOpenClassroomModal={() => handleOpenClassroomWithDraft()}
            onOpenGithubModal={() => setGithubModalOpen(true)}
          />
          <SiteFooter />
        </>
      )}

      {activeSection === 'mapa' && (
        <GlobeView liveData={liveData} onShareToClassroom={ownerShareHandler} />
      )}

      {activeSection === 'virus' && <VirusView onShareToClassroom={ownerShareHandler} />}

      {activeSection === 'dados' && (
        <>
          <BiostatisticsView
            liveData={liveData}
            onOpenGithubModal={() => setGithubModalOpen(true)}
            onShareToClassroom={ownerShareHandler}
          />
          <SiteFooter />
        </>
      )}

      {activeSection === 'prevencao' && (
        <>
          <PreventionView onShareToClassroom={ownerShareHandler} />
          <SiteFooter />
        </>
      )}

      <GithubModal
        open={githubModalOpen}
        githubUrl={githubUrl}
        onSaveUrl={(next) => setGithubUrl(next)}
        onClose={() => setGithubModalOpen(false)}
      />

      {isOwner && (
        <ClassroomModal
          open={classroomModalOpen}
          onClose={() => setClassroomModalOpen(false)}
          initialDraft={classroomDraft}
          liveData={liveData}
        />
      )}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[#D5E0EA] bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 text-xs text-[#475569] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-medium text-[#334155]">
          Projeto de Extensão Universitária em Farmácia · Saúde Pública, Epidemiologia e Vigilância
          no SUS
        </p>
        <p>Fontes de referência: Fiocruz · Ministério da Saúde · Instituto Adolfo Lutz · OMS</p>
      </div>
    </footer>
  );
}
