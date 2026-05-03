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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 p-6 shadow-xl border border-stone-100">
        <h2 className="text-lg font-bold text-stone-900 mb-3">{t(lang, 'terms.title')}</h2>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">{t(lang, 'terms.body')}</p>
        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#E07050]"
          />
          <span className="text-stone-700 text-sm">{t(lang, 'terms.accept')}</span>
        </label>
        <button
          onClick={handleAccept}
          disabled={!checked}
          className="w-full py-3 rounded-xl bg-[#E07050] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#cc6344] transition-colors"
        >
          {t(lang, 'terms.accept')}
        </button>
      </div>
    </div>
  );
}
