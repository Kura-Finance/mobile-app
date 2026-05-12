import enCommon from './en/common.json';
import zhTwCommon from './zh-TW/common.json';

export const resources = {
  en: {
    common: enCommon,
  },
  'zh-TW': {
    common: zhTwCommon,
  },
};

export type SupportedLanguage = keyof typeof resources;
