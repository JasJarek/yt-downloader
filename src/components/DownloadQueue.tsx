import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../store/downloadStore';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../i18n';
import { DownloadJob } from '../types';

function statusColor(status: DownloadJob['status']): string {
  switch (status) {
    case 'completed': return 'text-emerald-600';
    case 'failed': return 'text-red-500';
    case 'cancelled': return 'text-stone-400';
    case 'converting': return 'text-amber-500';
    default: return 'text-[#E07050]';
  }
}

function ProgressBar({ percent, status }: { percent: number; status: DownloadJob['status'] }) {
  const color =
    status === 'completed' ? 'bg-emerald-500' :
    status === 'failed' ? 'bg-red-400' :
    status === 'cancelled' ? 'bg-stone-300' :
    status === 'converting' ? 'bg-amber-400' : 'bg-[#E07050]';

  return (
    <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function DownloadQueue() {
  const { jobs, cancelJob, removeJob, clearCompleted } = useDownloadStore();
  const lang = useSettingsStore((s) => s.settings.language);

  if (jobs.length === 0) {
    return (
      <div className="text-stone-400 text-sm text-center py-8">
        {t(lang, 'download.empty')}
      </div>
    );
  }

  const handleCancel = async (id: string) => {
    await invoke('cancel_download', { id });
    cancelJob(id);
  };

  const hasFinished = jobs.some(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled'
  );

  return (
    <div className="flex flex-col gap-2">
      {hasFinished && (
        <div className="flex justify-end">
          <button
            onClick={clearCompleted}
            className="text-stone-400 hover:text-stone-600 text-xs transition-colors"
          >
            {lang === 'pl' ? 'Usuń zakończone' : 'Remove finished'}
          </button>
        </div>
      )}
      {jobs.map((job) => (
        <div key={job.id} className="bg-white border border-stone-100 rounded-xl p-3 shadow-sm">
          <div className="flex items-start gap-3">
            {job.thumbnail && (
              <img src={job.thumbnail} alt="" className="w-16 h-10 object-cover rounded-lg shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-stone-800 text-sm font-medium truncate">{job.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                  {t(lang, `download.stage.${job.status}`)}
                </span>
                <span className="text-stone-300 text-xs">{job.format.toUpperCase()}</span>
                {job.status === 'downloading' && job.speed && (
                  <span className="text-stone-400 text-xs">{job.speed}</span>
                )}
                {job.status === 'downloading' && job.eta && (
                  <span className="text-stone-400 text-xs">ETA {job.eta}</span>
                )}
              </div>
              {(job.status === 'downloading' || job.status === 'converting' || job.status === 'completed') && (
                <ProgressBar percent={job.percent} status={job.status} />
              )}
              {job.stage.startsWith('warn:') && (
                <p className="text-amber-500 text-xs mt-1 truncate" title={job.stage.slice(5)}>
                  ⚠ {job.stage.slice(5)}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {(job.status === 'downloading' || job.status === 'pending' || job.status === 'converting') && (
                <button
                  onClick={() => handleCancel(job.id)}
                  className="text-stone-400 hover:text-red-500 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-stone-100"
                >
                  {t(lang, 'download.cancel')}
                </button>
              )}
              {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                <button
                  onClick={() => removeJob(job.id)}
                  className="text-stone-300 hover:text-stone-500 text-lg leading-none transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
