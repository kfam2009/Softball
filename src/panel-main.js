const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const childProcess = require("child_process");
const path = require("path");
const { createServer } = require("./server");

const port = Number(process.env.B5_NDI_PORT || 8136);
const replayPanelPort = Number(process.env.REPLAY_PANEL_PORT || 3001);
const electronPath = process.execPath;
const replayKioskPath = path.join(__dirname, "replay-kiosk-main.js");
const startDisplayIndex = Number(process.env.B5_PANEL_DISPLAY || 0);
let windowRef;
let displayIndex = startDisplayIndex;
let localServer;

app.setPath("userData", path.resolve(__dirname, "..", "work", "softball-ndi-control"));

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!windowRef || windowRef.isDestroyed()) return;
    windowRef.setFullScreen(false);
    windowRef.show();
    windowRef.focus();
    windowRef.setFullScreen(true);
  });
}

function panelUrl() {
  return `http://localhost:${port}/control.html`;
}

async function waitForPanel() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(panelUrl(), { cache: "no-store" });
      if (response.ok) return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  return false;
}

function displayAt(index) {
  const displays = screen.getAllDisplays();
  const normalized = ((index % displays.length) + displays.length) % displays.length;
  displayIndex = normalized;
  return displays[normalized];
}

function moveToDisplay(index) {
  const display = displayAt(index);
  if (!windowRef) return;
  windowRef.setFullScreen(false);
  windowRef.setBounds(display.bounds);
  windowRef.setFullScreen(true);
  windowRef.focus();
}

async function openReplayPanel() {
  const child = childProcess.spawn(electronPath, [replayKioskPath], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      REPLAY_PANEL_PORT: String(replayPanelPort)
    },
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return { ok: true, mode: "kiosk", url: `http://localhost:${replayPanelPort}/` };
}

async function createWindow() {
  const panelReady = await waitForPanel();
  if (!panelReady) {
    localServer = createServer().listen(port);
    await waitForPanel();
  }
  const display = displayAt(displayIndex);
  windowRef = new BrowserWindow({
    ...display.bounds,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#10151b",
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: `${__dirname}\\panel-preload.js`
    }
  });

  await windowRef.loadURL(panelUrl());
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Alt+Right", () => moveToDisplay(displayIndex + 1));
  globalShortcut.register("CommandOrControl+Alt+Left", () => moveToDisplay(displayIndex - 1));
  globalShortcut.register("F11", () => windowRef?.setFullScreen(!windowRef.isFullScreen()));
  globalShortcut.register("Escape", () => windowRef?.setFullScreen(false));
  globalShortcut.register("CommandOrControl+Q", () => app.quit());
}

function registerIpc() {
  ipcMain.handle("panel:move-next", () => moveToDisplay(displayIndex + 1));
  ipcMain.handle("panel:move-prev", () => moveToDisplay(displayIndex - 1));
  ipcMain.handle("panel:toggle-fullscreen", () => windowRef?.setFullScreen(!windowRef.isFullScreen()));
  ipcMain.handle("panel:close", () => app.quit());
  ipcMain.handle("panel:open-replay", () => openReplayPanel());
}

if (singleInstanceLock) {
  app.whenReady().then(async () => {
    registerShortcuts();
    registerIpc();
    await createWindow();
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (localServer) localServer.close();
});
