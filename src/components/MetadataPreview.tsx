import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { VideoMetadata, DownloadFormat, Mp3Bitrate } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useDownloadStore } from '../store/downloadStore';
import { t } from '../i18n';
import { v4 as uuidv4 } from '../utils/uuid';

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  url: string;
  metadata: VideoMetadata;
  onClear: () => void;
}

export function MetadataPreview({ url, metadata, onClear }: Props) {
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { addJob, jobs } = useDownloadStore();
  const lang = settings.language;

  const [format, setFormat] = useState<DownloadFormat>('mp4');
  const [videoQuality, setVideoQuality] = useState(
    metadata.formats[metadata.formats.length - 1]?.format_id ?? settings.defaultVideoQuality
  );
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(settings.defaultMp3Bitrate);
  const [outputDir, setOutputDir] = useState(settings.defaultOutputDir);
  const [error, setError] = useState('');

  const activeCount = jobs.filter((j) => j.status === 'downloading' || j.status === 'converting').length;
  const canDownload = activeCount < settings.maxParallelDownloads;

  const handleBrowse = async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (dir && typeof dir === 'string') {
        setOutputDir(dir);
        setSettings({ defaultOutputDir: dir });
        await saveSettings();
      }
    } catch {
      // user cancelled
    }
  };

  const handleDownload = async () => {
    if (!outputDir) { setError(t(lang, 'errors.noOutputDir')); return; }
    setError('');

    const id = uuidv4();
    const job = {
      id,
      url,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      format,
      quality: format === 'mp4' ? videoQuality : bitrate,
      outputDir,
      status: 'pending' as const,
      percent: 0,
      speed: '',
      eta: '',
      stage: 'pending',
      createdAt: new Date().toISOString(),
    };

    addJob(job);

    try {
      await invoke('start_download', {
        request: {
          id,
          url,
          format,
          quality: format === 'mp4' ? videoQuality : bitrate,
          output_dir: outputDir,
          title: metadata.title,
        },
      });
    } catch {
      setError(t(lang, 'errors.downloadFailed'));
    }
  };

  const downloadLabel = format === 'mp4'
    ? (lang === 'pl' ? 'Pobierz Wideo' : 'Download Video')
    : (lang === 'pl' ? 'Pobierz Audio' : 'Download Audio');

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-stone-100">
      {/* Video info */}
      <div className="flex gap-4 p-4 items-start">
        {metadata.thumbnail && (
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="w-28 h-16 object-cover rounded-xl shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-stone-900 font-semibold text-sm leading-snug line-clamp-2">{metadata.title}</h3>
          <p className="text-stone-400 text-xs mt-1">{metadata.uploader}</p>
          <p className="text-stone-400 text-xs mt-0.5">{formatDuration(metadata.duration)}</p>
        </div>
        <button
          onClick={onClear}
          className="text-stone-300 hover:text-stone-500 transition-colors self-start text-lg leading-none ml-1"
        >
          ✕
        </button>
      </div>

      <div className="border-t border-stone-100 mx-4" />

      {/* Options */}
      <div className="px-4 py-4 flex flex-col gap-4">
        <p className="text-stone-700 font-semibold text-sm">Options</p>

        {/* Format toggle */}
        <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
          {(['mp4', 'mp3'] as DownloadFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                format === f
                  ? 'bg-[#E07050] text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-800'
              }`}
            >
              {f === 'mp4' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              )}
              {t(lang, `format.${f}`)}
            </button>
          ))}
        </div>

        {/* Quality / Bitrate */}
        {format === 'mp4' ? (
          <div>
            <label className="text-stone-500 text-xs font-medium mb-1.5 block">{t(lang, 'metadata.quality')}</label>
            <select
              value={videoQuality}
              onChange={(e) => setVideoQuality(e.target.value)}
              className="w-full bg-white border border-stone-200 text-stone-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E07050] transition-colors"
            >
              {metadata.formats.map((f) => (
                <option key={f.format_id} value={f.format_id}>{f.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-stone-500 text-xs font-medium mb-1.5 block">{t(lang, 'metadata.bitrate')}</label>
            <select
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value as Mp3Bitrate)}
              className="w-full bg-white border border-stone-200 text-stone-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E07050] transition-colors"
            >
              <option value="128">128 kbps</option>
              <option value="192">192 kbps</option>
              <option value="320">320 kbps</option>
            </select>
          </div>
        )}

        {/* Output directory */}
        <div>
          <label className="text-stone-500 text-xs font-medium mb-1.5 block">{t(lang, 'metadata.outputDir')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={outputDir}
              placeholder={t(lang, 'metadata.browse')}
              className="flex-1 bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-2.5 text-sm cursor-pointer focus:outline-none focus:border-[#E07050] transition-colors placeholder-stone-400"
              onClick={handleBrowse}
            />
            <button
              onClick={handleBrowse}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-sm transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}
        {!canDownload && (
          <p className="text-amber-600 text-xs">
            {lang === 'pl'
              ? `Osiągnięto limit ${settings.maxParallelDownloads} równoległych pobrań.`
              : `Reached limit of ${settings.maxParallelDownloads} parallel downloads.`}
          </p>
        )}

        <button
          onClick={handleDownload}
          disabled={!canDownload}
          className="w-full py-3 rounded-xl bg-[#E07050] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#cc6344] transition-colors"
        >
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}
