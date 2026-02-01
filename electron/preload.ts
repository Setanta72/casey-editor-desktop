import { contextBridge, ipcRenderer } from 'electron';

export interface AppConfig {
  sitePath: string;
  mediaPath: string;
  cloudinaryCloudName: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  setConfig: (config: Partial<AppConfig>): Promise<boolean> =>
    ipcRenderer.invoke('set-config', config),
  isConfigured: (): Promise<boolean> => ipcRenderer.invoke('is-configured'),

  // API URL
  getApiUrl: (): Promise<string> => ipcRenderer.invoke('get-api-url'),

  // Cloudinary credentials
  setCloudinaryCredentials: (apiKey: string, apiSecret: string): Promise<boolean> =>
    ipcRenderer.invoke('set-cloudinary-credentials', { apiKey, apiSecret }),

  // Directory selection
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),

  // Server control
  restartServer: (): Promise<boolean> => ipcRenderer.invoke('restart-server'),

  // Window title
  setTitle: (title: string): void => ipcRenderer.send('set-title', title)
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<AppConfig>;
      setConfig: (config: Partial<AppConfig>) => Promise<boolean>;
      isConfigured: () => Promise<boolean>;
      getApiUrl: () => Promise<string>;
      setCloudinaryCredentials: (apiKey: string, apiSecret: string) => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      restartServer: () => Promise<boolean>;
      setTitle: (title: string) => void;
    };
  }
}
