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
    } catch (e) {
      setError(t(lang, 'errors.downloadFailed'));
    }
  };

  return (
    <div className="bg-zinc-800 rounded-2xl border border-zinc-700 overflow-hidden">
      <div className="flex gap-4 p-4">
        {metadata.thumbnail && (
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="w-40 h-24 object-cover rounded-xl shrink-0"
          />
        )}
        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <h3 className="text-white font-semibold text-base leading-tight line-clamp-2">{metadata.title}</h3>
            <p className="text-zinc-400 text-sm mt-1">{metadata.uploader}</p>
          </div>
          <p className="text-zinc-500 text-sm">{formatDuration(metadata.duration)}</p>
        </div>
        <button onClick={onClear} className="text-zinc-500 hover:text-white transition-colors self-start text-xl leading-none">✕</button>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {/* Format selector */}
        <div className="flex gap-2">
          {(['mp4', 'mp3'] as DownloadFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                format === f
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {t(lang, `format.${f}`)}
            </button>
          ))}
        </div>

        {/* Quality/Bitrate */}
        {format === 'mp4' ? (
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">{t(lang, 'metadata.quality')}</label>
            <select
              value={videoQuality}
              onChange={(e) => setVideoQuality(e.target.value)}
              className="w-full bg-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {metadata.formats.map((f) => (
                <option key={f.format_id} value={f.format_id}>{f.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">{t(lang, 'metadata.bitrate')}</label>
            <select
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value as Mp3Bitrate)}
              className="w-full bg-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="128">128 kbps</option>
              <option value="192">192 kbps</option>
              <option value="320">320 kbps</option>
            </select>
          </div>
        )}

        {/* Output directory */}
        <div>
          <label className="text-zinc-400 text-xs mb-1 block">{t(lang, 'metadata.outputDir')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={outputDir}
              placeholder={t(lang, 'metadata.browse')}
              className="flex-1 bg-zinc-700 text-white rounded-lg px-3 py-2 text-sm cursor-pointer"
              onClick={handleBrowse}
            />
            <button
              onClick={handleBrowse}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
            >
              📁
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!canDownload && (
          <p className="text-yellow-400 text-sm">
            {lang === 'pl'
              ? `Osiągnięto limit ${settings.maxParallelDownloads} równoległych pobrań.`
              : `Reached limit of ${settings.maxParallelDownloads} parallel downloads.`}
          </p>
        )}

        <button
          onClick={handleDownload}
          disabled={!canDownload}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          {t(lang, 'download.start')}
        </button>
      </div>
    </div>
  );
}
