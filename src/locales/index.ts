import { en } from './en';
import { ko } from './ko';
import { i18n } from '../services/I18nService';

// Initialize i18n service with translations
i18n.initialize({
  en,
  ko
});

export { i18n };
export * from './en';
export * from './ko';