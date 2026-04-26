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
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={t(lang, 'url.placeholder')}
          className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
        />
        <button
          onClick={handleFetch}
          disabled={!isValid || loading}
          className="px-5 py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors whitespace-nowrap"
        >
          {loading ? t(lang, 'url.fetching') : t(lang, 'url.fetch')}
        </button>
      </div>
      {url && !isValid && (
        <p className="text-red-400 text-sm px-1">{t(lang, 'url.invalid')}</p>
      )}
      {error && (
        <p className="text-red-400 text-sm px-1">{error}</p>
      )}
    </div>
  );
}
