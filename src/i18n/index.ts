import { pl } from './pl';
import { en } from './en';

export const translations = { pl, en };
export type Language = keyof typeof translations;
export type Translations = typeof pl;

export function t(lang: Language, key: string): string {
  const keys = key.split('.');
  let val: unknown = translations[lang];
  for (const k of keys) {
    if (val && typeof val === 'object') {
      val = (val as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  return typeof val === 'string' ? val : key;
}
