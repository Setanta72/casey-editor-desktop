import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigStore } from './config-store';
import { createServer } from './server';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;
const configStore = new ConfigStore();

const API_PORT = 3001;

// Determine if we're in development
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

async function createWindow() {
  const bounds = configStore.getWindowBounds();

  // In dev mode, preload is in dist-electron; in prod it's alongside main.js
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path:', preloadPath);
  console.log('Is dev:', isDev);

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      configStore.setWindowBounds(mainWindow.getBounds());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the app
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading dev URL:', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Log any load errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
}

async function startServer(): Promise<boolean> {
  const config = configStore.getConfig();
  console.log('Starting server with config:', {
    sitePath: config.sitePath,
    mediaPath: config.mediaPath,
    cloudinaryCloudName: config.cloudinaryCloudName
  });

  if (!config.sitePath || !config.mediaPath) {
    console.log('Server not started: missing sitePath or mediaPath');
    return false;
  }

  try {
    const expressApp = await createServer({
      sitePath: config.sitePath,
      mediaPath: config.mediaPath,
      cloudinaryCloudName: config.cloudinaryCloudName || '',
      cloudinaryApiKey: await configStore.getCloudinaryApiKey() || '',
      cloudinaryApiSecret: await configStore.getCloudinaryApiSecret() || ''
    });

    return new Promise((resolve) => {
      server = expressApp.listen(API_PORT, '127.0.0.1', () => {
        console.log(`API server running on http://127.0.0.1:${API_PORT}`);
        resolve(true);
      });

      server.on('error', (err: any) => {
        console.error('Server error:', err.message);
        if (err.code === 'EADDRINUSE') {
          console.log('Port 3001 already in use - another instance may be running');
        }
        resolve(false);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    return false;
  }
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return configStore.getConfig();
});

ipcMain.handle('set-config', async (_event, config) => {
  configStore.setConfig(config);
  return true;
});

ipcMain.handle('get-api-url', () => {
  return `http://127.0.0.1:${API_PORT}`;
});

ipcMain.handle('set-cloudinary-credentials', async (_event, { apiKey, apiSecret }) => {
  await configStore.setCloudinaryApiKey(apiKey);
  await configStore.setCloudinaryApiSecret(apiSecret);
  return true;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('is-configured', () => {
  const config = configStore.getConfig();
  return !!(config.sitePath && config.mediaPath);
});

ipcMain.handle('restart-server', async () => {
  if (server) {
    server.close();
    server = null;
  }
  return await startServer();
});

ipcMain.on('set-title', (_event, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

// App lifecycle
app.whenReady().then(async () => {
  const isConfigured = configStore.getConfig().sitePath && configStore.getConfig().mediaPath;

  if (isConfigured) {
    await startServer();
  }

  await createWindow();
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
