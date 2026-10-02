const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('littleReminder', {
  getSettings: () => ipcRenderer.invoke('get-settings'),

  saveSettings: (settings) =>
    ipcRenderer.invoke('save-settings', settings),

  // WATER
  preview: () =>
    ipcRenderer.send('preview-reminder'),

  testInMinute: () =>
    ipcRenderer.send('test-reminder-in-minute'),

  // FOOD
  previewFood: () =>
    ipcRenderer.send('preview-food-reminder'),

  testFoodInMinute: () =>
    ipcRenderer.send('test-food-reminder-in-minute'),

  // REMINDER ACTIONS
  done: () =>
    ipcRenderer.send('reminder-done'),

  snooze: () =>
    ipcRenderer.send('reminder-snooze'),

  // COMPANION
  onShowReminder: (callback) =>
    ipcRenderer.on('show-reminder', (_event, data) => callback(data)),

  onHideReminder: (callback) =>
    ipcRenderer.on('hide-reminder', callback)
});