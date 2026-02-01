import express, { Express } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createSyncModule, ServerConfig } from './media-sync';

const execAsync = promisify(exec);

export async function createServer(config: ServerConfig): Promise<Express> {
  const app = express();

  const SITE_ROOT = config.sitePath;
  const CONTENT_ROOT = path.join(SITE_ROOT, 'src/content');
  const PUBLIC_ROOT = path.join(SITE_ROOT, 'public');
  const MEDIA_LIBRARY = config.mediaPath;

  // Create sync module with config
  const syncModule = createSyncModule(config);

  app.use(cors());
  app.use(express.json());

  // Root endpoint
  app.get('/', (_req, res) => {
    res.send('Casey Editor API is running');
  });

  // Serve static images from the site's public directory
  app.use('/images', express.static(path.join(PUBLIC_ROOT, 'images')));

  // Serve static images from the Media library
  app.use('/media', express.static(MEDIA_LIBRARY));

  // GET /api/content/:type - List files
  app.get('/api/content/:type', (req, res) => {
    const { type } = req.params;
    const dirPath = path.join(CONTENT_ROOT, type);

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: `Directory ${type} not found` });
    }

    try {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
      const fileData = files.map(file => {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
        const { data } = matter(content);
        return {
          filename: file,
          ...data
        };
      });
      res.json(fileData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/content/:type/:filename - Get file content
  app.get('/api/content/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const filePath = path.join(CONTENT_ROOT, type, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);
      res.json({ frontmatter: data, content, raw: fileContent });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/content/:type/:filename - Save file content
  app.post('/api/content/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const { frontmatter, content } = req.body;
    const dirPath = path.join(CONTENT_ROOT, type);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, filename);

    try {
      const fileContent = matter.stringify(content, frontmatter);
      fs.writeFileSync(filePath, fileContent);
      res.json({ success: true, message: 'File saved' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/content/:type/:filename - Delete file
  app.delete('/api/content/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const filePath = path.join(CONTENT_ROOT, type, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    try {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/media - List images from site public folder
  app.get('/api/media', (_req, res) => {
    const imagesDir = path.join(PUBLIC_ROOT, 'images');
    if (!fs.existsSync(imagesDir)) {
      return res.json([]);
    }

    function getImages(dir: string, baseDir = ''): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getImages(fullPath, path.join(baseDir, path.basename(fullPath))));
        } else {
          const ext = path.extname(fullPath).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
            results.push(path.join('/images', baseDir, path.basename(fullPath)));
          }
        }
      });
      return results;
    }

    try {
      const images = getImages(imagesDir);
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/media-library - List all images in media library
  app.get('/api/media-library', (_req, res) => {
    function scanDir(dir: string, prefix = ''): any[] {
      let results: any[] = [];
      if (!fs.existsSync(dir)) return results;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          results = results.concat(scanDir(fullPath, relativePath));
        } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(entry.name)) {
          const stats = fs.statSync(fullPath);
          results.push({
            path: `/media/${relativePath}`,
            relativePath: relativePath,
            name: entry.name,
            category: prefix.split('/')[0] || 'uncategorized',
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
      return results;
    }

    try {
      const images = scanDir(MEDIA_LIBRARY);
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/git/status - Get git status
  app.get('/api/git/status', async (_req, res) => {
    try {
      const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: SITE_ROOT });
      const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: SITE_ROOT });

      const changes = statusOut.trim().split('\n').filter(line => line.trim());
      const hasChanges = changes.length > 0;
      const branch = branchOut.trim();

      let ahead = 0;
      try {
        const { stdout: aheadOut } = await execAsync('git rev-list --count @{u}..HEAD', { cwd: SITE_ROOT });
        ahead = parseInt(aheadOut.trim()) || 0;
      } catch {
        // No upstream set
      }

      res.json({
        hasChanges,
        changes: changes.length,
        changesList: changes.slice(0, 20),
        branch,
        ahead
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/git/publish - Commit and push changes
  app.post('/api/git/publish', async (req, res) => {
    const { message } = req.body;
    const commitMsg = message || `Content update ${new Date().toISOString().split('T')[0]}`;

    try {
      await execAsync('git add -A', { cwd: SITE_ROOT });
      await execAsync(`git commit -m "${commitMsg}"`, { cwd: SITE_ROOT });
      await execAsync('git push', { cwd: SITE_ROOT });
      res.json({ success: true, message: 'Published successfully' });
    } catch (err: any) {
      if (err.message.includes('nothing to commit')) {
        res.json({ success: true, message: 'No changes to publish' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // POST /api/media/sync - Sync media to Cloudinary
  app.post('/api/media/sync', async (req, res) => {
    const { dryRun = false, force = false } = req.body;
    try {
      const results = await syncModule.syncMedia({ dryRun, force });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/media/mappings - Get local-to-CDN URL mappings
  app.get('/api/media/mappings', (_req, res) => {
    try {
      const mappings = syncModule.getUrlMappings();
      res.json(mappings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/media/publish - Full publish workflow
  app.post('/api/media/publish', async (req, res) => {
    const { message, dryRun = false } = req.body;
    try {
      const results = await syncModule.publish({ message, dryRun });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
