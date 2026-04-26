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

export default function App() {
  const { loadSettings, settings } = useSettingsStore();
  const { updateProgress, finishJob } = useDownloadStore();
  const lang = settings.language;

  const [tab, setTab] = useState<Tab>('download');
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  // Keep a ref to jobs so event callbacks always see current state
  const jobsRef = useRef<DownloadJob[]>([]);
  const jobs = useDownloadStore((s) => s.jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const unlistenProgress = listen<DownloadProgress>('download-progress', (e) => {
      updateProgress(e.payload);
    });

    const unlistenFinished = listen<DownloadFinished>('download-finished', async (e) => {
      const { id, status } = e.payload;
      finishJob({ id, status });

      // Save completed downloads to SQLite history
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <TermsModal />

      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">▶</span>
          <div>
            <h1 className="text-lg font-bold leading-none">{t(lang, 'app.title')}</h1>
            <p className="text-zinc-500 text-xs mt-0.5">{t(lang, 'app.subtitle')}</p>
          </div>
        </div>
        <nav className="flex gap-1">
          {(['download', 'history', 'settings'] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                tab === tabKey
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {t(lang, `nav.${tabKey}`)}
              {tabKey === 'download' && activeCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {tab === 'download' && (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
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
                <h2 className="text-white font-semibold mb-3">{t(lang, 'download.queue')}</h2>
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
