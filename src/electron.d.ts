// Type declarations for Electron API exposed via preload

export interface AppConfig {
  sitePath: string;
  mediaPath: string;
  cloudinaryCloudName: string;
}

declare global {
  interface Window {
    electronAPI?: {
      getConfig: () => Promise<AppConfig>;
      setConfig: (config: Partial<AppConfig>) => Promise<boolean>;
      isConfigured: () => Promise<boolean>;
      validateConfig: () => Promise<{ valid: boolean; errors: string[] }>;
      getConfigPath: () => Promise<string>;
      getApiUrl: () => Promise<string>;
      setCloudinaryCredentials: (apiKey: string, apiSecret: string) => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      restartServer: () => Promise<boolean>;
      setTitle: (title: string) => void;
    };
  }
}

export {};
