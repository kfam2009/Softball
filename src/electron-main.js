const { app, BrowserWindow, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const { createServer, readState } = require("./server");
const NdiSender = require("./ndi/ndi-sender");

const port = Number(process.env.B5_NDI_PORT || 8136);
const ndiEnabled = process.env.B5_NDI_ENABLED === "1";
const logPath = path.resolve(__dirname, "..", "work", "electron-ndi.log");
const targetWidth = 1920;
const targetHeight = 1080;
let server;
let sender;
let windowRef;
let frameCount = 0;
let lastLog = Date.now();
let invalidateTimer;
let captureTimer;
let sizeLogged = false;
let captureInFlight = false;

app.commandLine.appendSwitch("high-dpi-support", "1");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("disable-http-cache");

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`);
}

function fitBitmapToFrame(image, width, height) {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const requiredBytes = width * height * 4;

  if (size.width === width && size.height === height && bitmap.length === requiredBytes) {
    return { buffer: bitmap, size, padded: false };
  }

  const frame = Buffer.alloc(requiredBytes);
  const copyWidth = Math.min(size.width, width);
  const copyHeight = Math.min(size.height, height);
  const sourceStride = size.width * 4;
  const targetStride = width * 4;
  const sourceX = Math.max(0, Math.floor((size.width - copyWidth) / 2));
  const targetX = Math.max(0, Math.floor((width - copyWidth) / 2));

  for (let y = 0; y < copyHeight; y += 1) {
    const sourceStart = (y * sourceStride) + (sourceX * 4);
    const targetStart = (y * targetStride) + (targetX * 4);
    bitmap.copy(frame, targetStart, sourceStart, sourceStart + (copyWidth * 4));
  }

  return { buffer: frame, size, padded: true };
}

const hotkeys = [
  ["CommandOrControl+Alt+Shift+1", "away-minus"],
  ["CommandOrControl+Alt+Shift+2", "away-plus"],
  ["CommandOrControl+Alt+Shift+3", "home-minus"],
  ["CommandOrControl+Alt+Shift+4", "home-plus"],
  ["CommandOrControl+Alt+Shift+5", "out-minus"],
  ["CommandOrControl+Alt+Shift+6", "out-plus"],
  ["CommandOrControl+Alt+Shift+7", "base-first"],
  ["CommandOrControl+Alt+Shift+8", "base-second"],
  ["CommandOrControl+Alt+Shift+9", "base-third"],
  ["CommandOrControl+Alt+Shift+0", "half-toggle"],
  ["CommandOrControl+Alt+Shift+I", "inning-plus"],
  ["CommandOrControl+Alt+Shift+O", "scorebug-in"],
  ["CommandOrControl+Alt+Shift+P", "scorebug-out"],
  ["CommandOrControl+Alt+Shift+B", "bases-clear"],
  ["CommandOrControl+Alt+Shift+C", "outs-clear"],
  ["CommandOrControl+Alt+Shift+Q", "ball-plus"],
  ["CommandOrControl+Alt+Shift+W", "strike-plus"],
  ["CommandOrControl+Alt+Shift+F", "foul"],
  ["CommandOrControl+Alt+Shift+R", "count-reset"],
  ["CommandOrControl+Alt+Shift+X", "change-side"]
];

async function scorebugAction(action) {
  try {
    const response = await fetch(`http://localhost:${port}/api/scorebug/${action}`, { cache: "no-store" });
    const payload = await response.json();
    if (!payload.ok) log(`Hotkey ${action} failed: ${payload.error || response.status}`);
  } catch (error) {
    log(`Hotkey ${action} failed: ${error.message}`);
  }
}

function registerScorebugHotkeys() {
  for (const [shortcut, action] of hotkeys) {
    const ok = globalShortcut.register(shortcut, () => scorebugAction(action));
    log(`Hotkey ${shortcut} -> ${action}: ${ok ? "registered" : "failed"}`);
  }
}

async function start() {
  log("Starting Softball NDI Electron process.");
  server = createServer().listen(port);
  const state = readState();
  const ndi = state.ndi || {};
  const targetFps = Math.max(25, Math.min(30, Number(process.env.B5_NDI_FPS || ndi.fps || 30)));

  sender = new NdiSender({
    enabled: ndiEnabled,
    sourceName: ndi.sourceName || "B5 Scorebug",
    width: targetWidth,
    height: targetHeight,
    fps: targetFps,
    alpha: ndi.alpha !== false
  });
  await sender.open();
  log(`${sender.label} opened as: ${ndi.sourceName || "B5 Scorebug"}`);

  windowRef = new BrowserWindow({
    width: targetWidth,
    height: targetHeight,
    useContentSize: true,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false
    }
  });

  windowRef.webContents.setFrameRate(targetFps);
  windowRef.webContents.on("did-finish-load", () => {
    log("Scorebug page loaded in offscreen Chromium.");
    windowRef.webContents.invalidate();
  });

  await windowRef.loadURL(`http://localhost:${port}/graphics.html?v=${Date.now()}`);
  invalidateTimer = setInterval(() => {
    if (windowRef && !windowRef.isDestroyed()) windowRef.webContents.invalidate();
  }, Math.floor(1000 / targetFps));
  captureTimer = setInterval(async () => {
    if (!windowRef || windowRef.isDestroyed()) return;
    if (captureInFlight) return;
    captureInFlight = true;
    try {
      const captured = await windowRef.webContents.capturePage({
        x: 0,
        y: 0,
        width: targetWidth,
        height: targetHeight
      });
      const size = captured.getSize();
      const image = size.width === targetWidth && size.height === targetHeight
        ? captured
        : captured.resize({ width: targetWidth, height: targetHeight, quality: "best" });
      const frame = fitBitmapToFrame(image, targetWidth, targetHeight);

      if (!sizeLogged) {
        const normalized = image.getSize();
        log(`Capture size: ${size.width}x${size.height}; NDI frame: ${normalized.width}x${normalized.height}; bytes=${frame.buffer.length}; padded=${frame.padded}`);
        sizeLogged = true;
      }

      await sender.sendVideoFrame(frame.buffer);
      frameCount += 1;
      const now = Date.now();
      if (now - lastLog > 3000) {
        log(`${sender.label}: ${Math.round(frameCount * 1000 / (now - lastLog))} fps`);
        frameCount = 0;
        lastLog = now;
      }
    } catch (error) {
      log(`capturePage failed: ${error.message}`);
    } finally {
      captureInFlight = false;
    }
  }, Math.floor(1000 / targetFps));
  windowRef.webContents.invalidate();
  log(`Electron offscreen render: http://localhost:${port}/graphics.html`);
  log(`Control panel: http://localhost:${port}/control.html`);
}

app.whenReady().then(start).catch(error => {
  log(error.stack || error.message);
  app.quit();
});

app.whenReady().then(registerScorebugHotkeys);

app.on("window-all-closed", () => {
  if (process.platform === "win32") return;
  if (invalidateTimer) clearInterval(invalidateTimer);
  if (captureTimer) clearInterval(captureTimer);
  if (sender) sender.close();
  if (server) server.close();
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
