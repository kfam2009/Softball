const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("b5PanelWindow", {
  moveNext: () => ipcRenderer.invoke("panel:move-next"),
  movePrev: () => ipcRenderer.invoke("panel:move-prev"),
  toggleFullscreen: () => ipcRenderer.invoke("panel:toggle-fullscreen"),
  openReplay: () => ipcRenderer.invoke("panel:open-replay"),
  close: () => ipcRenderer.invoke("panel:close")
});
