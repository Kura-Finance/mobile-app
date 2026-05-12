import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as locales from './index';

// Use `i18n.use(...)` instead of the bare `use` import — the latter is
// indistinguishable from React's `use` hook to eslint-plugin-react-hooks.
i18n.use(initReactI18next).init({
  resources: locales.resources,
  lng: 'zh-TW',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  react: {
    useSuspense: false, // For React Native compatibility
  },
  interpolation: {
    escapeValue: false, // React already prevents XSS
  },
});

export default i18n;
