export interface AppSettings {
  connectionPanelPosition: 'top' | 'left' | 'right';
  manualCommandPosition: 'bottom' | 'left' | 'right';
  recentCommands: string[];
  theme: 'light' | 'dark';
  language: 'ko' | 'en';
}

export class SettingsService {
  private static readonly DB_NAME = 'ModbusAnalyzerSettings';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'settings';
  private static readonly SETTINGS_KEY = 'app_settings';
  
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private defaultSettings: AppSettings = {
    connectionPanelPosition: 'left',
    manualCommandPosition: 'bottom',
    recentCommands: [],
    theme: 'light',
    language: 'ko'
  };

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SettingsService.DB_NAME, SettingsService.DB_VERSION);
      
      request.onerror = () => {
        console.error('Failed to open settings database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create settings store
        if (!db.objectStoreNames.contains(SettingsService.STORE_NAME)) {
          db.createObjectStore(SettingsService.STORE_NAME);
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      await this.ensureDB();
      
      if (!this.db) {
        return { ...this.defaultSettings };
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SettingsService.STORE_NAME], 'readonly');
        const store = transaction.objectStore(SettingsService.STORE_NAME);
        const request = store.get(SettingsService.SETTINGS_KEY);
        
        request.onerror = () => {
          console.error('Failed to load settings:', request.error);
          resolve({ ...this.defaultSettings });
        };
        
        request.onsuccess = () => {
          const settings = request.result;
          if (settings) {
            // Merge with default settings to ensure all properties exist
            resolve({ ...this.defaultSettings, ...settings });
          } else {
            resolve({ ...this.defaultSettings });
          }
        };
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      return { ...this.defaultSettings };
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      await this.ensureDB();
      
      if (!this.db) {
        console.error('Database not available for saving settings');
        return;
      }

      // Load current settings and merge with new ones
      const currentSettings = await this.loadSettings();
      const updatedSettings = { ...currentSettings, ...settings };

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SettingsService.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(SettingsService.STORE_NAME);
        const request = store.put(updatedSettings, SettingsService.SETTINGS_KEY);
        
        request.onerror = () => {
          console.error('Failed to save settings:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  async updateConnectionPanelPosition(position: 'top' | 'left' | 'right'): Promise<void> {
    console.log('SettingsService: Updating connection panel position to:', position);
    await this.saveSettings({ connectionPanelPosition: position });
    console.log('SettingsService: Connection panel position saved');
  }

  async updateManualCommandPosition(position: 'bottom' | 'left' | 'right'): Promise<void> {
    console.log('SettingsService: Updating manual command position to:', position);
    await this.saveSettings({ manualCommandPosition: position });
    console.log('SettingsService: Manual command position saved');
  }

  async updateRecentCommands(commands: string[]): Promise<void> {
    // Keep only last 10 commands
    const trimmedCommands = commands.slice(-10);
    console.log('SettingsService: Saving recent commands to DB:', trimmedCommands);
    await this.saveSettings({ recentCommands: trimmedCommands });
  }

  async addRecentCommand(command: string): Promise<void> {
    console.log('SettingsService: Adding recent command:', command);
    const settings = await this.loadSettings();
    let recentCommands = [...settings.recentCommands];
    
    // Remove if already exists
    const existingIndex = recentCommands.indexOf(command);
    if (existingIndex !== -1) {
      recentCommands.splice(existingIndex, 1);
    }
    
    // Add to beginning
    recentCommands.unshift(command);
    
    // Keep only last 10
    recentCommands = recentCommands.slice(0, 10);
    
    console.log('SettingsService: Updated recent commands:', recentCommands);
    await this.updateRecentCommands(recentCommands);
  }

  async removeRecentCommand(index: number): Promise<void> {
    const settings = await this.loadSettings();
    const recentCommands = [...settings.recentCommands];
    
    if (index >= 0 && index < recentCommands.length) {
      recentCommands.splice(index, 1);
      await this.updateRecentCommands(recentCommands);
    }
  }

  async updateTheme(theme: 'light' | 'dark'): Promise<void> {
    await this.saveSettings({ theme });
  }

  async updateLanguage(language: 'ko' | 'en'): Promise<void> {
    await this.saveSettings({ language });
  }

  // Clear all settings
  async clearSettings(): Promise<void> {
    try {
      await this.ensureDB();
      
      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SettingsService.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(SettingsService.STORE_NAME);
        const request = store.delete(SettingsService.SETTINGS_KEY);
        
        request.onerror = () => {
          console.error('Failed to clear settings:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error('Error clearing settings:', error);
      throw error;
    }
  }
}