import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import type { Language } from '../store/useAppStore';
import i18n from '../locales/i18n';

/**
 * Keeps i18next in sync with the Zustand language preference app-wide.
 * Mount once near the app root (inside I18nextProvider).
 */
export function I18nLanguageSync() {
  const language = useAppStore((state) => state.preferences.language);

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);

  return null;
}

/**
 * Custom hook that combines react-i18next with the app's language preference
 * Automatically syncs the app's language setting with i18next
 */
export function useAppTranslation() {
  const { t, i18n: i18nInstance } = useTranslation('common');
  const language = useAppStore((state) => state.preferences.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  // Sync i18next language with app store when app language changes
  useEffect(() => {
    if (i18nInstance.language !== language) {
      void i18nInstance.changeLanguage(language);
    }
  }, [language, i18nInstance]);

  // Handle manual language change through i18next (if done outside the app store)
  const handleChangeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    void i18nInstance.changeLanguage(newLanguage);
  };

  return {
    t,
    language,
    changeLanguage: handleChangeLanguage,
  };
}
