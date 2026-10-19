const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ridwayFS', {
  pickFolder:     ()     => ipcRenderer.invoke('pick-folder'),
  saveToFolder:   (args) => ipcRenderer.invoke('save-to-folder', args),
  loadFromFolder: (args) => ipcRenderer.invoke('load-from-folder', args),
  checkFolder:    (args) => ipcRenderer.invoke('check-folder', args),
  listBackups:    (args) => ipcRenderer.invoke('list-backups', args),
});
