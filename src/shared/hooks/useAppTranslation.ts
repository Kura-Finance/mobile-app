import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import type { Language } from '../store/useAppStore';

/**
 * Custom hook that combines react-i18next with the app's language preference
 * Automatically syncs the app's language setting with i18next
 */
export function useAppTranslation() {
  const { t, i18n } = useTranslation('common');
  const language = useAppStore((state) => state.preferences.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  // Sync i18next language with app store when app language changes
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Handle manual language change through i18next (if done outside the app store)
  const handleChangeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
  };

  return {
    t,
    language,
    changeLanguage: handleChangeLanguage,
  };
}
