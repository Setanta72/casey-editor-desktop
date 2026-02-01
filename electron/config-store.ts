import Store from 'electron-store';
import * as keytar from 'keytar';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_NAME = 'casey-editor-desktop';

// Fallback: read from .env file if keytar fails
function readEnvFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
  const env: Record<string, string> = {};
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          env[match[1].trim()] = match[2].trim();
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return env;
}

interface StoredConfig {
  sitePath?: string;
  mediaPath?: string;
  cloudinaryCloudName?: string;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class ConfigStore {
  private store: Store<StoredConfig>;

  constructor() {
    this.store = new Store<StoredConfig>({
      name: 'config',
      defaults: {}
    });
  }

  // Path configuration
  getConfig(): StoredConfig {
    return {
      sitePath: this.store.get('sitePath'),
      mediaPath: this.store.get('mediaPath'),
      cloudinaryCloudName: this.store.get('cloudinaryCloudName')
    };
  }

  setConfig(config: Partial<StoredConfig>): void {
    if (config.sitePath !== undefined) {
      this.store.set('sitePath', config.sitePath);
    }
    if (config.mediaPath !== undefined) {
      this.store.set('mediaPath', config.mediaPath);
    }
    if (config.cloudinaryCloudName !== undefined) {
      this.store.set('cloudinaryCloudName', config.cloudinaryCloudName);
    }
  }

  // Window bounds
  getWindowBounds(): StoredConfig['windowBounds'] {
    return this.store.get('windowBounds');
  }

  setWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.store.set('windowBounds', bounds);
  }

  // Secure credential storage using system keychain
  async getCloudinaryApiKey(): Promise<string | null> {
    // Try keytar first
    try {
      const key = await keytar.getPassword(SERVICE_NAME, 'cloudinary-api-key');
      if (key) return key;
    } catch (e) {
      console.log('Keytar not available, using fallback');
    }

    // Fallback to .env file
    const env = readEnvFile();
    return env['CLOUDINARY_API_KEY'] || null;
  }

  async setCloudinaryApiKey(apiKey: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'cloudinary-api-key', apiKey);
    } catch (error) {
      console.error('Failed to store Cloudinary API key:', error);
    }
  }

  async getCloudinaryApiSecret(): Promise<string | null> {
    // Try keytar first
    try {
      const secret = await keytar.getPassword(SERVICE_NAME, 'cloudinary-api-secret');
      if (secret) return secret;
    } catch (e) {
      console.log('Keytar not available, using fallback');
    }

    // Fallback to .env file
    const env = readEnvFile();
    return env['CLOUDINARY_API_SECRET'] || null;
  }

  async setCloudinaryApiSecret(apiSecret: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'cloudinary-api-secret', apiSecret);
    } catch (error) {
      console.error('Failed to store Cloudinary API secret:', error);
    }
  }
}
