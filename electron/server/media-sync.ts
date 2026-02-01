import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ServerConfig {
  sitePath: string;
  mediaPath: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
}

interface CacheEntry {
  hash: string;
  url: string;
  public_id: string;
  uploaded_at: string;
}

interface SyncResults {
  scanned: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors: string[];
  uploads: { local: string; remote: string; size: number }[];
}

interface RewriteResults {
  filesScanned: number;
  filesModified: number;
  urlsReplaced: number;
  changes: { file: string; replacements: number }[];
}

export function createSyncModule(config: ServerConfig) {
  const SITE_ROOT = config.sitePath;
  const CONTENT_ROOT = path.join(SITE_ROOT, 'src/content');
  const MEDIA_LIBRARY = config.mediaPath;
  const UPLOAD_CACHE_FILE = path.join(SITE_ROOT, '.upload-cache.json');

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true
  });

  function loadCache(): Record<string, CacheEntry> {
    try {
      if (fs.existsSync(UPLOAD_CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(UPLOAD_CACHE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load cache:', e);
    }
    return {};
  }

  function saveCache(cache: Record<string, CacheEntry>): void {
    fs.writeFileSync(UPLOAD_CACHE_FILE, JSON.stringify(cache, null, 2));
  }

  function getFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  function findImageReferences(): string[] {
    const images = new Set<string>();
    const contentTypes = ['posts', 'projects', 'pieces', 'notes'];

    const patterns = [
      /!\[.*?\]\(\/media\/([^)]+)\)/g,
      /!\[.*?\]\(\.\.\/\.\.\/\.\.\/Media\/([^)]+)\)/g,
      /image:\s*["']?\/media\/([^"'\s]+)/g,
      /src=["']\/media\/([^"']+)/g
    ];

    for (const type of contentTypes) {
      const dir = path.join(CONTENT_ROOT, type);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');

        for (const pattern of patterns) {
          let match;
          const regex = new RegExp(pattern.source, pattern.flags);
          while ((match = regex.exec(content)) !== null) {
            images.add(match[1]);
          }
        }
      }
    }

    return Array.from(images);
  }

  async function uploadImage(localPath: string): Promise<{ url: string; public_id: string; bytes: number } | null> {
    const fullPath = path.join(MEDIA_LIBRARY, localPath);

    if (!fs.existsSync(fullPath)) {
      console.error(`Image not found: ${fullPath}`);
      return null;
    }

    try {
      const result = await cloudinary.uploader.upload(fullPath, {
        public_id: `casey-site/${localPath.replace(/\.[^.]+$/, '')}`,
        folder: 'casey-site',
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        bytes: result.bytes
      };
    } catch (error: any) {
      console.error(`Failed to upload ${localPath}:`, error.message);
      return null;
    }
  }

  async function syncMedia(options: { dryRun?: boolean; force?: boolean } = {}): Promise<SyncResults> {
    const { dryRun = false, force = false } = options;
    const cache = loadCache();
    const results: SyncResults = {
      scanned: 0,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      uploads: []
    };

    console.log('Scanning content for image references...');
    const references = findImageReferences();
    results.scanned = references.length;
    console.log(`Found ${references.length} image references`);

    for (const ref of references) {
      const localPath = ref;
      const fullPath = path.join(MEDIA_LIBRARY, localPath);

      if (!fs.existsSync(fullPath)) {
        console.log(`  [MISSING] ${localPath}`);
        results.failed++;
        results.errors.push(`File not found: ${localPath}`);
        continue;
      }

      const hash = getFileHash(fullPath);

      if (!force && cache[localPath] && cache[localPath].hash === hash) {
        console.log(`  [CACHED] ${localPath}`);
        results.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [WOULD UPLOAD] ${localPath}`);
        results.uploaded++;
        continue;
      }

      console.log(`  [UPLOADING] ${localPath}...`);
      const result = await uploadImage(localPath);

      if (result) {
        cache[localPath] = {
          hash,
          url: result.url,
          public_id: result.public_id,
          uploaded_at: new Date().toISOString()
        };
        results.uploaded++;
        results.uploads.push({
          local: localPath,
          remote: result.url,
          size: result.bytes
        });
        console.log(`  [DONE] ${localPath} -> ${result.url}`);
      } else {
        results.failed++;
        results.errors.push(`Upload failed: ${localPath}`);
      }
    }

    if (!dryRun) {
      saveCache(cache);
    }

    return results;
  }

  function rewriteUrls(options: { dryRun?: boolean } = {}): RewriteResults {
    const { dryRun = false } = options;
    const cache = loadCache();
    const contentTypes = ['posts', 'projects', 'pieces', 'notes'];
    const results: RewriteResults = {
      filesScanned: 0,
      filesModified: 0,
      urlsReplaced: 0,
      changes: []
    };

    console.log('Rewriting /media/ URLs to Cloudinary...');

    for (const type of contentTypes) {
      const dir = path.join(CONTENT_ROOT, type);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        let fileChanges = 0;

        results.filesScanned++;

        for (const [localPath, data] of Object.entries(cache)) {
          const mediaPath = `/media/${localPath}`;
          if (content.includes(mediaPath)) {
            content = content.split(mediaPath).join(data.url);
            fileChanges++;
            results.urlsReplaced++;
          }
        }

        if (fileChanges > 0) {
          results.filesModified++;
          results.changes.push({ file: `${type}/${file}`, replacements: fileChanges });
          console.log(`  [REWRITE] ${type}/${file} (${fileChanges} URLs)`);

          if (!dryRun) {
            fs.writeFileSync(filePath, content);
          }
        }
      }
    }

    return results;
  }

  function getUrlMappings(): Record<string, string> {
    const cache = loadCache();
    const mappings: Record<string, string> = {};
    for (const [local, data] of Object.entries(cache)) {
      mappings[`/media/${local}`] = data.url;
    }
    return mappings;
  }

  async function publish(options: { message?: string; dryRun?: boolean } = {}): Promise<{
    syncResults: SyncResults;
    rewriteResults: RewriteResults;
    gitResult: string | null;
    error?: string;
  }> {
    const { message, dryRun = false } = options;

    console.log('=== Publishing ===\n');

    // Step 1: Sync media
    console.log('Step 1: Syncing media to Cloudinary...');
    const syncResults = await syncMedia({ dryRun });
    console.log(`  Uploaded: ${syncResults.uploaded}, Cached: ${syncResults.skipped}, Failed: ${syncResults.failed}\n`);

    // Step 2: Rewrite URLs
    console.log('Step 2: Rewriting URLs...');
    const rewriteResults = rewriteUrls({ dryRun });
    console.log(`  Files modified: ${rewriteResults.filesModified}, URLs replaced: ${rewriteResults.urlsReplaced}\n`);

    if (dryRun) {
      console.log('Dry run complete. No changes made.');
      return { syncResults, rewriteResults, gitResult: null };
    }

    // Step 3: Git commit and push
    console.log('Step 3: Committing and pushing...');
    const commitMsg = message || `Content update ${new Date().toISOString().split('T')[0]}`;

    try {
      await execAsync('git add -A', { cwd: SITE_ROOT });
      await execAsync(`git commit -m "${commitMsg}"`, { cwd: SITE_ROOT });
      await execAsync('git push', { cwd: SITE_ROOT });
      console.log('  Pushed to GitHub!\n');
      console.log('=== Published successfully! ===');
      return { syncResults, rewriteResults, gitResult: 'success' };
    } catch (err: any) {
      if (err.message.includes('nothing to commit')) {
        console.log('  No changes to commit.\n');
        return { syncResults, rewriteResults, gitResult: 'no-changes' };
      }
      console.error('  Git error:', err.message);
      return { syncResults, rewriteResults, gitResult: 'error', error: err.message };
    }
  }

  return {
    syncMedia,
    rewriteUrls,
    getUrlMappings,
    publish
  };
}
