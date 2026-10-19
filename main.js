const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    title: 'InstaPay — Hire Purchase Tracker',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#f0f7f2',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Backup Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select This Folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-to-folder', async (event, { folderPath, branch, data }) => {
  try {
    const safeBranch = (branch || 'main').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const filename   = `instapay-${safeBranch}-data.json`;
    const fullPath   = path.join(folderPath, filename);
    fs.writeFileSync(fullPath, data, 'utf8');
    return { ok: true, path: fullPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('load-from-folder', async (event, { folderPath, branch }) => {
  try {
    const safeBranch = (branch || 'main').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const filename   = `instapay-${safeBranch}-data.json`;
    const fullPath   = path.join(folderPath, filename);
    if (!fs.existsSync(fullPath)) return { ok: false, error: 'No backup file found in that folder.' };
    const raw  = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('check-folder', async (event, { folderPath }) => {
  return { exists: fs.existsSync(folderPath) };
});

ipcMain.handle('list-backups', async (event, { folderPath }) => {
  try {
    const files = fs.readdirSync(folderPath)
      .filter(f => f.startsWith('instapay-') && f.endsWith('-data.json'))
      .map(f => {
        const fullPath = path.join(folderPath, f);
        const stat     = fs.statSync(fullPath);
        return { name: f, modified: stat.mtime.toISOString(), path: fullPath };
      });
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── App menu ──────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: '💾 Save Now', accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.executeJavaScript('manualSave && manualSave()') },
        { label: '☁️ Backup to Folder', accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.webContents.executeJavaScript('saveToFolder && saveToFolder()') },
        { type: 'separator' },
        { label: '📁 Change Backup Folder',
          click: () => mainWindow.webContents.executeJavaScript('pickSaveFolder && pickSaveFolder()') },
        { label: '🔄 Restore from Folder',
          click: () => mainWindow.webContents.executeJavaScript('restoreFromFolder && restoreFromFolder()') },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Dashboard',        click: () => mainWindow.webContents.executeJavaScript("showView('dashboard')") },
        { label: 'All Clients',      click: () => mainWindow.webContents.executeJavaScript("showView('clients')") },
        { label: 'Payments Log',     click: () => mainWindow.webContents.executeJavaScript("showView('payments')") },
        { label: 'Ready to Deliver', click: () => mainWindow.webContents.executeJavaScript("showView('ready')") },
        { type: 'separator' },
        { label: 'Zoom In',    accelerator: 'CmdOrCtrl+=', click: () => { const z = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.min(z+0.1,2)); } },
        { label: 'Zoom Out',   accelerator: 'CmdOrCtrl+-', click: () => { const z = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.max(z-0.1,0.5)); } },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomFactor(1) },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About InstaPay',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About InstaPay',
            message: 'InstaPay — Hire Purchase Tracker',
            detail: 'Version 1.0.0\n\nA complete hire purchase installment tracking system.\nManage clients, payments, workers and deliveries\nall in one place.\n\nDefault admin password: admin123\nChange it in Settings after first login.',
            buttons: ['OK']
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => { createWindow(); buildMenu(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
