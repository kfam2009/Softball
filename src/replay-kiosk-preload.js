const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("replayPanelWindow", {
  moveNext: () => ipcRenderer.invoke("replay:move-next"),
  movePrev: () => ipcRenderer.invoke("replay:move-prev"),
  toggleFullscreen: () => ipcRenderer.invoke("replay:toggle-fullscreen"),
  close: () => ipcRenderer.invoke("replay:close")
});
