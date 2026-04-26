import { create } from 'zustand';
import { AppSettings } from '../types';

const DEFAULTS: AppSettings = {
  defaultOutputDir: '',
  defaultVideoQuality: 'bestvideo[height<=720]',
  defaultMp3Bitrate: '192',
  maxParallelDownloads: 3,
  language: 'pl',
  acceptedTerms: false,
};

interface SettingsState {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULTS,

  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  loadSettings: async () => {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      const saved = await store.get<AppSettings>('app_settings');
      if (saved) {
        set({ settings: { ...DEFAULTS, ...saved } });
      }
    } catch {
      // store plugin not available in dev fallback
    }
  },

  saveSettings: async () => {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      await store.set('app_settings', get().settings);
      await store.save();
    } catch {
      // ignore
    }
  },
}));
