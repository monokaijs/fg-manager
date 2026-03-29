import { useMemo } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { translations } from './translations';

type Params = Record<string, string | number>;

function getValueByPath(source: Record<string, any>, path: string): string {
  const keys = path.split('.');
  let current: any = source;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return path;
    }
  }

  return typeof current === 'string' ? current : path;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function useI18n() {
  const language = useSettingsStore((state) => state.language);

  const dictionary = useMemo(() => translations[language] ?? translations.en, [language]);

  const t = (key: string, params?: Params) => interpolate(getValueByPath(dictionary as Record<string, any>, key), params);

  return {
    language,
    t,
  };
}
