import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
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
      nodeIntegration: false,
      spellcheck: true
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

  // Set spell check language
  mainWindow.webContents.session.setSpellCheckerLanguages(['en-GB', 'en-US']);

  // Enable right-click context menu
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = [];

    // Add spell check suggestions for misspelled words
    if (params.misspelledWord) {
      console.log('Misspelled word:', params.misspelledWord);
      console.log('Suggestions:', params.dictionarySuggestions);

      if (params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
          menuItems.push({
            label: suggestion,
            click: () => mainWindow?.webContents.replaceMisspelling(suggestion)
          });
        }
        menuItems.push({ type: 'separator' });
      } else {
        menuItems.push({ label: '(No suggestions)', enabled: false });
        menuItems.push({ type: 'separator' });
      }
      menuItems.push({
        label: 'Add to Dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      });
      menuItems.push({ type: 'separator' });
    }

    // Add text editing options when there's editable text
    if (params.isEditable) {
      menuItems.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Select All', role: 'selectAll' }
      );
    } else if (params.selectionText) {
      // Text is selected but not editable
      menuItems.push(
        { label: 'Copy', role: 'copy' }
      );
    }

    // Add link options
    if (params.linkURL) {
      if (menuItems.length > 0) menuItems.push({ type: 'separator' });
      menuItems.push(
        { label: 'Copy Link', click: () => require('electron').clipboard.writeText(params.linkURL) }
      );
    }

    // Add image options
    if (params.mediaType === 'image') {
      if (menuItems.length > 0) menuItems.push({ type: 'separator' });
      menuItems.push(
        { label: 'Copy Image URL', click: () => require('electron').clipboard.writeText(params.srcURL) }
      );
    }

    // Add inspect element in dev mode
    if (isDev) {
      if (menuItems.length > 0) menuItems.push({ type: 'separator' });
      menuItems.push(
        { label: 'Inspect Element', click: () => mainWindow?.webContents.inspectElement(params.x, params.y) }
      );
    }

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup();
    }
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

ipcMain.handle('validate-config', () => {
  return configStore.validateConfig();
});

ipcMain.handle('get-config-path', () => {
  return configStore.getConfigPath();
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
  // Create application menu
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Select All', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Toggle DevTools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { label: 'Reset Zoom', role: 'resetZoom' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

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
