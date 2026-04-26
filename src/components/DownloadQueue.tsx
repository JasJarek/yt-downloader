import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../store/downloadStore';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../i18n';
import { DownloadJob } from '../types';

function statusColor(status: DownloadJob['status']): string {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'failed': return 'text-red-400';
    case 'cancelled': return 'text-zinc-500';
    case 'converting': return 'text-yellow-400';
    default: return 'text-blue-400';
  }
}

function ProgressBar({ percent, status }: { percent: number; status: DownloadJob['status'] }) {
  const color =
    status === 'completed' ? 'bg-green-500' :
    status === 'failed' ? 'bg-red-500' :
    status === 'cancelled' ? 'bg-zinc-600' :
    status === 'converting' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-2">
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
      <div className="text-zinc-500 text-sm text-center py-8">
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
            className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            {lang === 'pl' ? 'Usuń zakończone' : 'Remove finished'}
          </button>
        </div>
      )}
      {jobs.map((job) => (
        <div key={job.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
          <div className="flex items-start gap-3">
            {job.thumbnail && (
              <img src={job.thumbnail} alt="" className="w-16 h-10 object-cover rounded-lg shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{job.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                  {t(lang, `download.stage.${job.status}`)}
                </span>
                <span className="text-zinc-600 text-xs">{job.format.toUpperCase()}</span>
                {job.status === 'downloading' && job.speed && (
                  <span className="text-zinc-500 text-xs">{job.speed}</span>
                )}
                {job.status === 'downloading' && job.eta && (
                  <span className="text-zinc-500 text-xs">ETA {job.eta}</span>
                )}
              </div>
              {(job.status === 'downloading' || job.status === 'converting' || job.status === 'completed') && (
                <ProgressBar percent={job.percent} status={job.status} />
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {(job.status === 'downloading' || job.status === 'pending' || job.status === 'converting') && (
                <button
                  onClick={() => handleCancel(job.id)}
                  className="text-zinc-500 hover:text-red-400 text-xs transition-colors px-2 py-1 rounded hover:bg-zinc-700"
                >
                  {t(lang, 'download.cancel')}
                </button>
              )}
              {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                <button
                  onClick={() => removeJob(job.id)}
                  className="text-zinc-600 hover:text-zinc-400 text-lg leading-none transition-colors"
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
