import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { DownloadRecord } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../i18n';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function HistoryView() {
  const lang = useSettingsStore((s) => s.settings.language);
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await invoke<DownloadRecord[]>('get_history');
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    await invoke('clear_history');
    setRecords([]);
  };

  const handleOpenFolder = async (filePath: string) => {
    try {
      const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
      await openPath(dir);
    } catch { }
  };

  if (loading) {
    return <div className="text-stone-400 text-sm text-center py-8">...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-stone-400 text-sm text-center py-8">
        {t(lang, 'history.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-stone-800 font-semibold text-sm">{t(lang, 'history.title')}</h2>
        <button
          onClick={handleClear}
          className="text-stone-400 hover:text-red-500 text-xs transition-colors"
        >
          {t(lang, 'history.clear')}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {records.map((r) => (
          <div key={r.id} className="bg-white border border-stone-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-stone-800 text-sm font-medium truncate">{r.title}</p>
              <p className="text-stone-400 text-xs mt-0.5">
                {r.format.toUpperCase()} · {r.quality} · {formatDate(r.created_at)}
              </p>
            </div>
            <span className={`text-xs font-medium shrink-0 ${r.status === 'completed' ? 'text-emerald-600' : 'text-red-500'}`}>
              {t(lang, `download.stage.${r.status}`)}
            </span>
            {r.file_path && r.status === 'completed' && (
              <button
                onClick={() => handleOpenFolder(r.file_path)}
                className="text-stone-300 hover:text-stone-600 transition-colors shrink-0"
                title={t(lang, 'history.openFolder')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
