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
    <div className="flex flex-col gap-4 max-w-lg">
      <h2 className="text-stone-800 font-semibold text-sm">{t(lang, 'settings.title')}</h2>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 divide-y divide-stone-100">
        {/* Default output directory */}
        <div className="p-4">
          <label className="text-stone-500 text-xs font-medium block mb-2">{t(lang, 'settings.defaultDir')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={settings.defaultOutputDir}
              onClick={handleBrowse}
              placeholder={t(lang, 'metadata.browse')}
              className="flex-1 bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-3 py-2 text-sm cursor-pointer focus:outline-none focus:border-[#E07050] transition-colors placeholder-stone-400"
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

        {/* Default video quality */}
        <div className="p-4">
          <label className="text-stone-500 text-xs font-medium block mb-2">{t(lang, 'settings.defaultVideoQuality')}</label>
          <select
            value={settings.defaultVideoQuality}
            onChange={(e) => setSettings({ defaultVideoQuality: e.target.value })}
            className="w-full bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E07050] transition-colors"
          >
            <option value="bestvideo[height<=360][vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[height<=360]+bestaudio">360p</option>
            <option value="bestvideo[height<=480][vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[height<=480]+bestaudio">480p</option>
            <option value="bestvideo[height<=720][vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[height<=720]+bestaudio">720p</option>
            <option value="bestvideo[height<=1080][vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080]+bestaudio">1080p</option>
            <option value="bestvideo[vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo+bestaudio">Best available</option>
          </select>
        </div>

        {/* Default MP3 bitrate */}
        <div className="p-4">
          <label className="text-stone-500 text-xs font-medium block mb-2">{t(lang, 'settings.defaultBitrate')}</label>
          <select
            value={settings.defaultMp3Bitrate}
            onChange={(e) => setSettings({ defaultMp3Bitrate: e.target.value as AppSettings['defaultMp3Bitrate'] })}
            className="w-full bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#E07050] transition-colors"
          >
            <option value="128">128 kbps</option>
            <option value="192">192 kbps</option>
            <option value="320">320 kbps</option>
          </select>
        </div>

        {/* Max parallel downloads */}
        <div className="p-4">
          <label className="text-stone-500 text-xs font-medium block mb-2">
            {t(lang, 'settings.maxParallel')}: <span className="text-stone-800 font-semibold">{settings.maxParallelDownloads}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={settings.maxParallelDownloads}
            onChange={(e) => setSettings({ maxParallelDownloads: Number(e.target.value) })}
            className="w-full accent-[#E07050]"
          />
          <div className="flex justify-between text-stone-300 text-xs mt-1">
            {[1, 2, 3, 4, 5].map((n) => <span key={n}>{n}</span>)}
          </div>
        </div>

        {/* Language */}
        <div className="p-4">
          <label className="text-stone-500 text-xs font-medium block mb-2">{t(lang, 'settings.language')}</label>
          <div className="flex gap-2">
            {(['pl', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setSettings({ language: l })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  settings.language === l
                    ? 'bg-[#E07050] text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {l === 'pl' ? '🇵🇱 Polski' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="py-3 rounded-xl bg-[#E07050] text-white font-semibold text-sm hover:bg-[#cc6344] transition-colors"
      >
        {saved ? t(lang, 'settings.saved') : t(lang, 'settings.save')}
      </button>
    </div>
  );
}
