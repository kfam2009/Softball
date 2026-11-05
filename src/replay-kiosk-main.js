const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const childProcess = require("child_process");
const path = require("path");

const replayPanelRoot = process.env.REPLAY_PANEL_ROOT || "C:\\Users\\claud\\Videos\\Panel Replay";
const replayPanelPort = Number(process.env.REPLAY_PANEL_PORT || 3001);
const replayNode = path.join(replayPanelRoot, "runtime", "node.exe");
const startDisplayIndex = Number(process.env.REPLAY_PANEL_DISPLAY || process.env.B5_PANEL_DISPLAY || 0);
let windowRef;
let displayIndex = startDisplayIndex;
let serverProcess = null;

app.setPath("userData", path.resolve(__dirname, "..", "work", "replay-kiosk-control"));

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => focusWindow());
}

function replayUrl() {
  return `http://localhost:${replayPanelPort}/`;
}

async function replayPanelIsRunning() {
  try {
    const response = await fetch(replayUrl(), { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForReplayPanel() {
  const deadline = Date.now() + 9000;
  while (Date.now() < deadline) {
    if (await replayPanelIsRunning()) return true;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  return false;
}

function startReplayServer() {
  serverProcess = childProcess.spawn(replayNode, ["server.js"], {
    cwd: replayPanelRoot,
    env: {
      ...process.env,
      PORT: String(replayPanelPort),
      VMIX_HOST: process.env.VMIX_HOST || "127.0.0.1",
      VMIX_PORT: process.env.VMIX_PORT || "8088"
    },
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  serverProcess.unref();
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

function focusWindow() {
  if (!windowRef || windowRef.isDestroyed()) return;
  windowRef.setFullScreen(false);
  windowRef.show();
  windowRef.focus();
  windowRef.setFullScreen(true);
}

async function createWindow() {
  if (!(await replayPanelIsRunning())) {
    startReplayServer();
    await waitForReplayPanel();
  }

  const display = displayAt(displayIndex);
  windowRef = new BrowserWindow({
    ...display.bounds,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#070b10",
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "replay-kiosk-preload.js")
    }
  });

  await windowRef.loadURL(replayUrl());
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Alt+Right", () => moveToDisplay(displayIndex + 1));
  globalShortcut.register("CommandOrControl+Alt+Left", () => moveToDisplay(displayIndex - 1));
  globalShortcut.register("F11", () => windowRef?.setFullScreen(!windowRef.isFullScreen()));
  globalShortcut.register("Escape", () => windowRef?.setFullScreen(false));
  globalShortcut.register("CommandOrControl+Q", () => app.quit());
}

function registerIpc() {
  ipcMain.handle("replay:move-next", () => moveToDisplay(displayIndex + 1));
  ipcMain.handle("replay:move-prev", () => moveToDisplay(displayIndex - 1));
  ipcMain.handle("replay:toggle-fullscreen", () => windowRef?.setFullScreen(!windowRef.isFullScreen()));
  ipcMain.handle("replay:close", () => app.quit());
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
});
