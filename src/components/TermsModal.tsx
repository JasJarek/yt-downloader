import { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../i18n';

export function TermsModal() {
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const lang = settings.language;
  const [checked, setChecked] = useState(false);

  if (settings.acceptedTerms) return null;

  const handleAccept = async () => {
    if (!checked) return;
    setSettings({ acceptedTerms: true });
    await saveSettings();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full mx-4 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">{t(lang, 'terms.title')}</h2>
        <p className="text-zinc-300 text-sm leading-relaxed mb-6">{t(lang, 'terms.body')}</p>
        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 w-4 h-4 accent-red-500"
          />
          <span className="text-zinc-200 text-sm">{t(lang, 'terms.accept')}</span>
        </label>
        <button
          onClick={handleAccept}
          disabled={!checked}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          {t(lang, 'terms.accept')}
        </button>
      </div>
    </div>
  );
}
