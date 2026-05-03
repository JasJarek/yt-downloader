import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { VideoMetadata, DownloadProgress, DownloadFinished, DownloadJob } from './types';
import { useDownloadStore } from './store/downloadStore';
import { useSettingsStore } from './store/settingsStore';
import { t } from './i18n';
import { TermsModal } from './components/TermsModal';
import { UrlInput } from './components/UrlInput';
import { MetadataPreview } from './components/MetadataPreview';
import { DownloadQueue } from './components/DownloadQueue';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';

type Tab = 'download' | 'history' | 'settings';

function TabIcon({ tab }: { tab: Tab }) {
  if (tab === 'download') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3m0 12l-4-4m4 4l4-4"/><path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
    </svg>
  );
  if (tab === 'history') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

export default function App() {
  const { loadSettings, settings } = useSettingsStore();
  const { updateProgress, finishJob } = useDownloadStore();
  const lang = settings.language;

  const [tab, setTab] = useState<Tab>('download');
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const jobsRef = useRef<DownloadJob[]>([]);
  const jobs = useDownloadStore((s) => s.jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    const unlistenProgress = listen<DownloadProgress>('download-progress', (e) => {
      updateProgress(e.payload);
    });

    const unlistenFinished = listen<DownloadFinished>('download-finished', async (e) => {
      const { id, status } = e.payload;
      finishJob({ id, status });

      if (status === 'completed') {
        const job = jobsRef.current.find((j) => j.id === id);
        if (job) {
          await invoke('save_download_record', {
            record: {
              id: job.id,
              title: job.title,
              url: job.url,
              format: job.format,
              quality: job.quality,
              file_path: job.outputDir,
              status: 'completed',
              created_at: new Date().toISOString(),
            },
          }).catch(() => {});
        }
      }
    });

    const unlistenCancelled = listen<string>('download-cancelled', (e) => {
      finishJob({ id: e.payload, status: 'failed' });
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenFinished.then((f) => f());
      unlistenCancelled.then((f) => f());
    };
  }, []);

  const handleMetadata = (fetchedUrl: string, meta: VideoMetadata) => {
    setUrl(fetchedUrl);
    setMetadata(meta);
  };

  const activeCount = jobs.filter(
    (j) => j.status === 'downloading' || j.status === 'converting' || j.status === 'pending'
  ).length;

  const tabLabels: Record<Tab, string> = {
    download: 'Downloader',
    history: 'History',
    settings: 'Settings',
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col">
      <TermsModal />

      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-stone-900 rounded-xl flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4"/>
              <rect x="2" y="19" width="20" height="2" rx="1" fill="white" stroke="none"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-stone-900">{t(lang, 'app.title')}</h1>
            <p className="text-stone-400 text-xs">{t(lang, 'app.subtitle')}</p>
          </div>
        </div>

        <nav className="bg-stone-100 rounded-xl p-1 flex gap-0.5">
          {(['download', 'history', 'settings'] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === tabKey
                  ? 'bg-white shadow-sm text-stone-800'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <TabIcon tab={tabKey} />
              <span>[{tabLabels[tabKey]}]</span>
              {tabKey === 'download' && activeCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E07050] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {tab === 'download' && (
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <UrlInput onMetadata={handleMetadata} />
            {metadata && (
              <MetadataPreview
                url={url}
                metadata={metadata}
                onClear={() => { setMetadata(null); setUrl(''); }}
              />
            )}
            {jobs.length > 0 && (
              <section>
                <h2 className="text-stone-700 font-semibold mb-3 text-sm">{t(lang, 'download.queue')}</h2>
                <DownloadQueue />
              </section>
            )}
          </div>
        )}
        {tab === 'history' && (
          <div className="max-w-2xl mx-auto">
            <HistoryView key={tab} />
          </div>
        )}
        {tab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <SettingsView />
          </div>
        )}
      </main>
    </div>
  );
}
