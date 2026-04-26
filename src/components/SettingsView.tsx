import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../i18n';
import { AppSettings } from '../types';

export function SettingsView() {
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const lang = settings.language;
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await saveSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBrowse = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir && typeof dir === 'string') {
      setSettings({ defaultOutputDir: dir });
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h2 className="text-white font-semibold text-lg">{t(lang, 'settings.title')}</h2>

      {/* Default output directory */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">{t(lang, 'settings.defaultDir')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={settings.defaultOutputDir}
            onClick={handleBrowse}
            placeholder={t(lang, 'metadata.browse')}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm cursor-pointer focus:outline-none focus:border-red-500"
          />
          <button
            onClick={handleBrowse}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
          >
            📁
          </button>
        </div>
      </div>

      {/* Default video quality */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">{t(lang, 'settings.defaultVideoQuality')}</label>
        <select
          value={settings.defaultVideoQuality}
          onChange={(e) => setSettings({ defaultVideoQuality: e.target.value })}
          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
        >
          <option value="bestvideo[height<=360]+bestaudio">360p</option>
          <option value="bestvideo[height<=480]+bestaudio">480p</option>
          <option value="bestvideo[height<=720]+bestaudio">720p</option>
          <option value="bestvideo[height<=1080]+bestaudio">1080p</option>
          <option value="bestvideo+bestaudio">Best available</option>
        </select>
      </div>

      {/* Default MP3 bitrate */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">{t(lang, 'settings.defaultBitrate')}</label>
        <select
          value={settings.defaultMp3Bitrate}
          onChange={(e) => setSettings({ defaultMp3Bitrate: e.target.value as AppSettings['defaultMp3Bitrate'] })}
          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
        >
          <option value="128">128 kbps</option>
          <option value="192">192 kbps</option>
          <option value="320">320 kbps</option>
        </select>
      </div>

      {/* Max parallel downloads */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">
          {t(lang, 'settings.maxParallel')}: {settings.maxParallelDownloads}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={settings.maxParallelDownloads}
          onChange={(e) => setSettings({ maxParallelDownloads: Number(e.target.value) })}
          className="w-full accent-red-500"
        />
        <div className="flex justify-between text-zinc-600 text-xs mt-1">
          {[1, 2, 3, 4, 5].map((n) => <span key={n}>{n}</span>)}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">{t(lang, 'settings.language')}</label>
        <div className="flex gap-2">
          {(['pl', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setSettings({ language: l })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.language === l
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {l === 'pl' ? '🇵🇱 Polski' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
      >
        {saved ? t(lang, 'settings.saved') : t(lang, 'settings.save')}
      </button>
    </div>
  );
}
