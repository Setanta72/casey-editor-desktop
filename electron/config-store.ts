import Store from 'electron-store';
import * as keytar from 'keytar';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const SERVICE_NAME = 'proofmark';
const OLD_SERVICE_NAME = 'casey-editor-desktop';

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
  migrated?: boolean;
}

export class ConfigStore {
  private store: Store<StoredConfig>;

  constructor() {
    this.store = new Store<StoredConfig>({
      name: 'config',
      defaults: {}
    });

    // Attempt migration from old config on first access
    this.migrateOldConfig();
  }

  // Check for old config locations and migrate
  private migrateOldConfig(): void {
    // Skip if already migrated
    if (this.store.get('migrated')) {
      return;
    }

    const oldConfigPaths = this.getOldConfigPaths();

    for (const oldPath of oldConfigPaths) {
      if (fs.existsSync(oldPath)) {
        console.log(`Found old config at: ${oldPath}`);
        try {
          const oldConfig = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));

          // Migrate settings if current store is empty
          if (!this.store.get('sitePath') && oldConfig.sitePath) {
            console.log('Migrating sitePath:', oldConfig.sitePath);
            this.store.set('sitePath', oldConfig.sitePath);
          }
          if (!this.store.get('mediaPath') && oldConfig.mediaPath) {
            console.log('Migrating mediaPath:', oldConfig.mediaPath);
            this.store.set('mediaPath', oldConfig.mediaPath);
          }
          if (!this.store.get('cloudinaryCloudName') && oldConfig.cloudinaryCloudName) {
            console.log('Migrating cloudinaryCloudName:', oldConfig.cloudinaryCloudName);
            this.store.set('cloudinaryCloudName', oldConfig.cloudinaryCloudName);
          }
          if (!this.store.get('windowBounds') && oldConfig.windowBounds) {
            this.store.set('windowBounds', oldConfig.windowBounds);
          }

          console.log('Migration complete');
          break; // Only migrate from first found config
        } catch (err) {
          console.error('Failed to migrate old config:', err);
        }
      }
    }

    // Also migrate keytar credentials from old service name
    this.migrateKeytarCredentials();

    // Mark as migrated
    this.store.set('migrated', true);
  }

  private getOldConfigPaths(): string[] {
    const paths: string[] = [];
    const userDataPath = app.getPath('userData');
    const parentDir = path.dirname(userDataPath);

    // Check various old locations
    const oldAppNames = ['casey-editor-desktop', 'Casey Editor', 'casey-editor'];

    for (const oldName of oldAppNames) {
      paths.push(path.join(parentDir, oldName, 'config.json'));
    }

    return paths;
  }

  private async migrateKeytarCredentials(): Promise<void> {
    try {
      // Try to get credentials from old service name
      const oldApiKey = await keytar.getPassword(OLD_SERVICE_NAME, 'cloudinary-api-key');
      const oldApiSecret = await keytar.getPassword(OLD_SERVICE_NAME, 'cloudinary-api-secret');

      // If found, copy to new service name
      if (oldApiKey) {
        const existingKey = await keytar.getPassword(SERVICE_NAME, 'cloudinary-api-key');
        if (!existingKey) {
          console.log('Migrating API key from old keychain entry');
          await keytar.setPassword(SERVICE_NAME, 'cloudinary-api-key', oldApiKey);
        }
      }

      if (oldApiSecret) {
        const existingSecret = await keytar.getPassword(SERVICE_NAME, 'cloudinary-api-secret');
        if (!existingSecret) {
          console.log('Migrating API secret from old keychain entry');
          await keytar.setPassword(SERVICE_NAME, 'cloudinary-api-secret', oldApiSecret);
        }
      }
    } catch (err) {
      console.log('Keytar migration skipped (keytar may not be available):', err);
    }
  }

  // Validate that paths exist and are correct
  validateConfig(): { valid: boolean; errors: string[] } {
    const config = this.getConfig();
    const errors: string[] = [];

    if (!config.sitePath) {
      errors.push('Website directory not configured');
    } else if (!fs.existsSync(config.sitePath)) {
      errors.push(`Website directory not found: ${config.sitePath}`);
    } else {
      // Check for expected Astro structure
      const contentPath = path.join(config.sitePath, 'src', 'content');
      if (!fs.existsSync(contentPath)) {
        errors.push(`No src/content/ folder found in website directory`);
      }
    }

    if (!config.mediaPath) {
      errors.push('Media library not configured');
    } else if (!fs.existsSync(config.mediaPath)) {
      errors.push(`Media library not found: ${config.mediaPath}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
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
    return env['CLOUDINARY_API_KEY'] || process.env.CLOUDINARY_API_KEY || null;
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
    return env['CLOUDINARY_API_SECRET'] || process.env.CLOUDINARY_API_SECRET || null;
  }

  async setCloudinaryApiSecret(apiSecret: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'cloudinary-api-secret', apiSecret);
    } catch (error) {
      console.error('Failed to store Cloudinary API secret:', error);
    }
  }

  // Get config file location for debugging
  getConfigPath(): string {
    return this.store.path;
  }
}
