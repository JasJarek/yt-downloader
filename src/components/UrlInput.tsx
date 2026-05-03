import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VideoMetadata } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../i18n';

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/;

interface Props {
  onMetadata: (url: string, meta: VideoMetadata) => void;
}

export function UrlInput({ onMetadata }: Props) {
  const lang = useSettingsStore((s) => s.settings.language);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = YT_REGEX.test(url.trim());

  const handleFetch = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const meta = await invoke<VideoMetadata>('fetch_metadata', { url: url.trim() });
      onMetadata(url.trim(), meta);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('unavailable') || msg.includes('removed')) {
        setError(t(lang, 'errors.unavailable'));
      } else if (msg.includes('regional') || msg.includes('not available in your country')) {
        setError(t(lang, 'errors.regional'));
      } else {
        setError(t(lang, 'errors.fetchFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [url, isValid, lang, onMetadata]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center bg-white border border-stone-200 rounded-xl px-4 gap-2 focus-within:border-[#E07050] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={t(lang, 'url.placeholder')}
            className="flex-1 py-3 text-sm text-stone-800 placeholder-stone-400 bg-transparent focus:outline-none"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={!isValid || loading}
          className="px-5 py-3 rounded-xl bg-stone-800 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-900 transition-colors whitespace-nowrap"
        >
          {loading ? t(lang, 'url.fetching') : t(lang, 'url.fetch')}
        </button>
      </div>
      {url && !isValid && (
        <p className="text-red-500 text-xs px-1">{t(lang, 'url.invalid')}</p>
      )}
      {error && (
        <p className="text-red-500 text-xs px-1">{error}</p>
      )}
    </div>
  );
}
