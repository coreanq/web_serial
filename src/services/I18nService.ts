export type SupportedLanguage = 'en' | 'ko';

export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

export class I18nService {
  private static instance: I18nService;
  private currentLanguage: SupportedLanguage = 'en';
  private translations: Record<SupportedLanguage, TranslationMap> = {
    en: {},
    ko: {}
  };
  private changeListeners: Array<(lang: SupportedLanguage) => void> = [];

  private constructor() {
    // Load saved language preference or detect browser language
    this.loadLanguagePreference();
  }

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /**
   * Initialize with translation data
   */
  initialize(translations: Record<SupportedLanguage, TranslationMap>): void {
    this.translations = translations;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Set current language and save preference
   */
  setLanguage(language: SupportedLanguage): void {
    if (this.currentLanguage !== language) {
      this.currentLanguage = language;
      this.saveLanguagePreference();
      this.notifyLanguageChange();
    }
  }

  /**
   * Get translated text by key with fallback support
   */
  t(key: string, params?: Record<string, string | number>): string | string[] {
    const translation = this.getNestedTranslation(key, this.currentLanguage);
    
    if (translation) {
      return Array.isArray(translation) ? translation : this.interpolateParams(translation, params);
    }

    // Fallback to English if translation not found
    if (this.currentLanguage !== 'en') {
      const fallback = this.getNestedTranslation(key, 'en');
      if (fallback) {
        return Array.isArray(fallback) ? fallback : this.interpolateParams(fallback, params);
      }
    }

    // Return key if no translation found
    console.warn(`Translation not found: ${key}`);
    return key;
  }

  /**
   * Get nested translation by dot notation key
   */
  private getNestedTranslation(key: string, language: SupportedLanguage): string | string[] | null {
    const keys = key.split('.');
    let current: any = this.translations[language];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return (typeof current === 'string' || Array.isArray(current)) ? current : null;
  }

  /**
   * Interpolate parameters in translation string
   */
  private interpolateParams(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  /**
   * Load language preference from localStorage
   */
  private loadLanguagePreference(): void {
    try {
      const saved = localStorage.getItem('modbus-analyzer-language');
      if (saved && (saved === 'en' || saved === 'ko')) {
        this.currentLanguage = saved;
        return;
      }
    } catch (error) {
      console.warn('Failed to load language preference:', error);
    }

    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ko')) {
      this.currentLanguage = 'ko';
    } else {
      this.currentLanguage = 'en';
    }
  }

  /**
   * Save language preference to localStorage
   */
  private saveLanguagePreference(): void {
    try {
      localStorage.setItem('modbus-analyzer-language', this.currentLanguage);
    } catch (error) {
      console.warn('Failed to save language preference:', error);
    }
  }

  /**
   * Add language change listener
   */
  onLanguageChange(callback: (lang: SupportedLanguage) => void): void {
    this.changeListeners.push(callback);
  }

  /**
   * Remove language change listener
   */
  removeLanguageChangeListener(callback: (lang: SupportedLanguage) => void): void {
    const index = this.changeListeners.indexOf(callback);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of language change
   */
  private notifyLanguageChange(): void {
    this.changeListeners.forEach(callback => {
      try {
        callback(this.currentLanguage);
      } catch (error) {
        console.error('Error in language change listener:', error);
      }
    });
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' }
    ];
  }
}

// Export singleton instance
export const i18n = I18nService.getInstance();