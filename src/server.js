const http = require("http");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const dataRoot = path.join(root, "data");
const statePath = path.join(dataRoot, "state.json");
// Datos.xlsx va en la carpeta que contiene softball-ndi (ej: Videos\\Softball2026\\Datos.xlsx).
const configPath = path.join(root, "data", "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Orden: variable SB_EXCEL > ruta elegida en el panel > carpeta de arriba > carpeta del panel.
function getExcelPath() {
  if (process.env.SB_EXCEL) return { path: process.env.SB_EXCEL, source: "variable SB_EXCEL" };
  const configured = readConfig().excelPath;
  if (configured) return { path: configured, source: "elegida en el panel" };
  const candidates = [path.resolve(root, "..", "Datos.xlsx"), path.join(root, "Datos.xlsx")];
  const found = candidates.find(file => fs.existsSync(file));
  return { path: found || candidates[1], source: found ? "automática" : "automática (no encontrada)" };
}
const codexPython = "C:\\Users\\claud\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const pythonPath = process.env.PYTHON || (fs.existsSync(codexPython) ? codexPython : "python");
const replayPanelRoot = process.env.REPLAY_PANEL_ROOT || "C:\\Users\\claud\\Videos\\Panel Replay";
const replayPanelPort = Number(process.env.REPLAY_PANEL_PORT || 3001);
const electronPath = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const replayKioskPath = path.join(root, "src", "replay-kiosk-main.js");
const clients = new Set();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif"
};
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);

function ensureState() {
  if (!fs.existsSync(dataRoot)) fs.mkdirSync(dataRoot, { recursive: true });
  if (!fs.existsSync(statePath)) {
    const defaultState = require("./defaultState");
    fs.writeFileSync(statePath, JSON.stringify(defaultState, null, 2));
  }
}

function readState() {
  ensureState();
  return normalizeState(JSON.parse(fs.readFileSync(statePath, "utf8").replace(/^\uFEFF/, "")));
}

function writeState(state) {
  ensureState();
  fs.writeFileSync(statePath, JSON.stringify(normalizeState(state), null, 2));
}

function normalizeState(state) {
  state.event ||= { name: "Softball 2026", status: "LIVE" };
  state.theme ||= {
    ink: "#10151b",
    panel: "#17222c",
    teal: "#00a78e",
    mint: "#9df1d7",
    coral: "#ff4f5e",
    gold: "#ffc83d",
    paper: "#f7f3ea",
    white: "#ffffff"
  };
  state.match ||= {};
  const match = state.match;
  match.gameId = String(match.gameId || "").trim();
  delete match.set;
  match.inning = Math.max(1, Number(match.inning || 1));
  match.half = match.half === "BOTTOM" ? "BOTTOM" : "TOP";
  match.outs = clamp(Number(match.outs || 0), 0, 2);
  match.balls = clamp(Number(match.balls || 0), 0, 3);
  match.strikes = clamp(Number(match.strikes || 0), 0, 2);
  match.regulationInnings = Number(match.regulationInnings || 7);
  match.tiebreakInning = Number(match.tiebreakInning || 0); // 0 = auto (reglamentarias + 1)
  match.autoTiebreak = match.autoTiebreak !== false;
  match.bases ||= { first: false, second: false, third: false };
  match.teams ||= {};
  for (const [side, defaults] of Object.entries({
    away: { name: "Visitante", short: "VIS", color: "#1f9d55" },
    home: { name: "Local", short: "LOC", color: "#62b5e5" }
  })) {
    const team = match.teams[side] ||= {};
    team.name ||= defaults.name;
    team.short ||= defaults.short;
    team.color ||= defaults.color;
    team.logo ||= "";
    team.score = Number(team.score || 0);
    team.hits = Number(team.hits || 0);
    team.errors = Number(team.errors || 0);
    team.line = Array.isArray(team.line) ? team.line.map(value => Number(value) || 0) : [];
    delete team.setsWon;
  }
  state.scoreboard ||= { title: "LINE SCORE", subtitle: state.event.name };
  state.matchup ||= { title: "MATCHUP", subtitle: state.event.name, round: "Fase de grupos", venue: "", titleScale: 1 };
  state.rosters ||= { title: "TEAM ROSTER", subtitle: state.event.name, away: { playersText: "" }, home: { playersText: "" } };
  state.rosters.away ||= { playersText: "" };
  state.rosters.home ||= { playersText: "" };
  state.lineups ||= { title: "LINEUP", subtitle: state.event.name };
  state.lineups.home ||= { text: "" };
  state.lineups.away ||= { text: "" };
  state.defense ||= { title: "DEFENSE", subtitle: state.event.name, side: "auto" };
  state.umpires ||= { title: "OFFICIALS", subtitle: state.event.name, crewText: "" };
  state.player ||= { title: "PLAYER", subtitle: state.event.name, teamSide: "home", number: "", name: "", detail: "" };
  state.commentators ||= { title: "COMMENTATORS", subtitle: state.event.name, layout: "two", name1: "", role1: "Play-by-play", name2: "", role2: "Analyst" };
  state.upcoming ||= {
    title: "UPCOMING GAMES",
    subtitle: state.event.name,
    count: "3",
    games: [
      { away: "", home: "", time: "", court: "Diamante 1", round: "", status: "Next" },
      { away: "", home: "", time: "", court: "Diamante 1", round: "", status: "Game 2" },
      { away: "", home: "", time: "", court: "Diamante 1", round: "", status: "Game 3" }
    ]
  };
  adsDefaults(state);
  state.upcoming.games ||= [];
  state.upcoming.diamond ||= "";
  while (state.upcoming.games.length < 3) state.upcoming.games.push({ away: "", home: "", time: "", court: "", round: "", status: "" });
  state.ndi ||= {};
  state.ndi.sourceName ||= "B5 Scorebug"; // mismo nombre NDI que usa el input 8 del proyecto vMix
  state.ndi.width ||= 1920;
  state.ndi.height ||= 1080;
  state.ndi.fps ||= 30;
  state.ndi.alpha = state.ndi.alpha !== false;
  state.ndi.activeGraphic ||= "scorebug";
  if (state.ndi.scorebugVisible === undefined) state.ndi.scorebugVisible = state.ndi.activeGraphic === "scorebug" && state.ndi.visible !== false;
  if (state.ndi.playerVisible === undefined) state.ndi.playerVisible = state.ndi.activeGraphic === "player" && state.ndi.visible !== false;
  if (state.ndi.visible === undefined) state.ndi.visible = true;
  state.excel ||= { home: [], away: [] };
  return state;
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function broadcast(state) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) res.write(payload);
}

const undoStack = [];

// ---------- Logos ----------
// Carpeta "Logos" al lado del Datos.xlsx (o la de SB_LOGOS). Cualquier imagen ahi aparece en el panel.
function logosDir() {
  const dir = process.env.SB_LOGOS || path.join(path.dirname(getExcelPath().path), "Logos");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function prettyName(file) {
  return path.basename(file, path.extname(file)).replace(/[-_]+/g, " ").trim();
}

function listLogos() {
  const list = [];
  const userDir = logosDir();
  for (const file of fs.readdirSync(userDir).sort((a, b) => a.localeCompare(b))) {
    if (imageExtensions.has(path.extname(file).toLowerCase())) {
      list.push({ value: `logos/${encodeURIComponent(file)}`, label: prettyName(file), file, source: "Logos" });
    }
  }
  return list;
}

function safeLogoName(name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (!imageExtensions.has(ext)) throw new Error("Formato no soportado. Usar PNG, JPG, WEBP, SVG o GIF.");
  const base = path.basename(String(name), path.extname(String(name)))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "").trim().replace(/\s+/g, "-") || "logo";
  return `${base.slice(0, 60)}${ext}`;
}

function handleLogoUpload(req, res, url) {
  let fileName;
  try {
    fileName = safeLogoName(url.searchParams.get("name"));
  } catch (error) {
    return sendJson(res, { ok: false, error: error.message }, 400);
  }
  const chunks = [];
  let size = 0;
  req.on("data", chunk => {
    size += chunk.length;
    if (size > 15 * 1024 * 1024) {
      sendJson(res, { ok: false, error: "El archivo supera 15 MB." }, 413);
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (res.writableEnded) return;
    try {
      fs.writeFileSync(path.join(logosDir(), fileName), Buffer.concat(chunks));
      sendJson(res, { ok: true, value: `logos/${encodeURIComponent(fileName)}`, logos: listLogos() });
    } catch (error) {
      sendJson(res, { ok: false, error: error.message }, 500);
    }
  });
}

// ---------- Publicidades y zocalos ----------
// Carpeta "Publicidades" (al lado del Excel o en una subcarpeta) con imagenes 1920x1080 a pantalla completa,
// y adentro "Zocalos" con PNG transparentes 1920x1080. Se puede fijar otra carpeta desde el panel.
function findAdsFolder() {
  const configured = readConfig().adsFolder;
  if (configured) return { path: configured, source: "elegida en el panel" };
  const base = path.dirname(getExcelPath().path);
  const isAds = name => /^publicidad(es)?$/i.test(name);
  try {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && isAds(entry.name)) return { path: path.join(base, entry.name), source: "automática" };
    }
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const inner = path.join(base, entry.name);
      for (const sub of fs.readdirSync(inner, { withFileTypes: true })) {
        if (sub.isDirectory() && isAds(sub.name)) return { path: path.join(inner, sub.name), source: "automática" };
      }
    }
  } catch {}
  return { path: path.join(base, "Publicidades"), source: "automática (no encontrada)" };
}

function listImages(dir) {
  try {
    return fs.readdirSync(dir).filter(file => imageExtensions.has(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  } catch {
    return [];
  }
}

function adsCatalog() {
  const folder = findAdsFolder();
  let zocalosDir = "";
  try {
    const entry = fs.readdirSync(folder.path, { withFileTypes: true }).find(item => item.isDirectory() && /^z[oó]calos?$/i.test(item.name.normalize("NFC")));
    if (entry) zocalosDir = entry.name;
  } catch {}
  const enc = file => file.split("/").map(encodeURIComponent).join("/");
  return {
    folder: folder.path,
    source: folder.source,
    exists: fs.existsSync(folder.path),
    full: listImages(folder.path).map(file => ({ file, label: prettyName(file).replace(/^publicidad\s*/i, "").replace(/\s*1920x1080$/i, ""), src: `ads/${enc(file)}` })),
    zocalos: zocalosDir ? listImages(path.join(folder.path, zocalosDir)).map(file => ({ file, label: prettyName(file).replace(/^z[oó]calo\s*/i, "").replace(/\s*1920x1080$/i, ""), src: `ads/${enc(`${zocalosDir}/${file}`)}` })) : []
  };
}

function serveAd(res, urlPath) {
  const folder = path.resolve(findAdsFolder().path);
  const rel = decodeURIComponent(urlPath.slice("/ads/".length));
  const file = path.resolve(folder, rel);
  if (!file.startsWith(folder + path.sep) || !imageExtensions.has(path.extname(file).toLowerCase())) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}

function adsDefaults(state) {
  state.ads ||= {};
  for (const [kind, seconds] of [["full", 8], ["zocalo", 10]]) {
    const item = state.ads[kind] ||= {};
    item.visible = Boolean(item.visible);
    item.index = Number(item.index || 0);
    item.startedAt = Number(item.startedAt || 0);
    item.seconds = Math.max(2, Math.min(120, Number(item.seconds || seconds)));
    item.mode = item.mode === "once" ? "once" : item.mode === "fixed" ? "fixed" : "loop";
  }
  if (state.ads.zocalo.hideScorebug === undefined) state.ads.zocalo.hideScorebug = true;
  state.ads.zocalo.hideScorebug = state.ads.zocalo.hideScorebug !== false && state.ads.zocalo.hideScorebug !== "false";
  return state.ads;
}

function adCount(state, kind) {
  const list = state.ads?.files?.[kind === "full" ? "full" : "zocalos"] || [];
  return list.length;
}

function currentAdIndex(state, kind, now = Date.now()) {
  const item = state.ads[kind];
  const total = adCount(state, kind);
  if (!total) return 0;
  if (!item.visible || item.mode === "fixed") return ((item.index % total) + total) % total;
  const steps = Math.floor((now - item.startedAt) / (item.seconds * 1000));
  return (((item.index + steps) % total) + total) % total;
}

function refreshAdFiles(state) {
  const catalog = adsCatalog();
  state.ads.files = { full: catalog.full, zocalos: catalog.zocalos };
  return catalog;
}

function applyAdAction(state, action) {
  const match = /^(ad|zocalo)-(in|out|next|prev|select-(\d+))$/.exec(action);
  if (!match) return false;
  adsDefaults(state);
  refreshAdFiles(state);
  const kind = match[1] === "ad" ? "full" : "zocalo";
  const item = state.ads[kind];
  const total = adCount(state, kind);
  const op = match[2];
  if (op === "in") {
    if (!total) throw new Error(kind === "full" ? "No hay publicidades en la carpeta." : "No hay zócalos en la carpeta.");
    item.visible = true;
    item.startedAt = Date.now();
  } else if (op === "out") {
    item.index = currentAdIndex(state, kind);
    item.visible = false;
  } else if (op === "next" || op === "prev") {
    if (!total) return true;
    item.index = (currentAdIndex(state, kind) + (op === "next" ? 1 : -1) + total) % total;
    item.startedAt = Date.now();
  } else if (match[3] !== undefined) {
    item.index = Math.min(Number(match[3]), Math.max(0, total - 1));
    item.startedAt = Date.now();
  }
  return true;
}

// Modo "una vuelta": cuando pasaron todas, sale sola.
setInterval(() => {
  try {
    if (!fs.existsSync(statePath)) return;
    const state = readState();
    if (!state.ads) return;
    let changed = false;
    for (const kind of ["full", "zocalo"]) {
      const item = state.ads[kind];
      const total = adCount(state, kind);
      if (item?.visible && item.mode === "once" && total && Date.now() - item.startedAt >= total * item.seconds * 1000) {
        item.visible = false;
        item.index = 0;
        changed = true;
      }
    }
    if (changed) {
      writeState(state);
      broadcast(readState());
    }
  } catch {}
}, 500).unref();

// ---------- vMix (camaras y replay desde el panel / MIDI) ----------
function vmixSettings() {
  const config = readConfig();
  return { host: config.vmixHost || "127.0.0.1", port: Number(config.vmixPort || 8088) };
}

function vmixCall(params) {
  const { host, port } = vmixSettings();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const target = `http://${host}:${port}/api/?${query.toString()}`;
  return new Promise((resolve, reject) => {
    const req = http.get(target, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => body += chunk);
      response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    req.setTimeout(2500, () => req.destroy(new Error(`vMix no responde en ${host}:${port}. En vMix: Settings > Web Controller activado.`)));
    req.on("error", reject);
  });
}

// Velocidad del replay con rampa gradual: la hace el servidor (el navegador frena sus
// temporizadores cuando la pestana queda en segundo plano y la rampa se cortaba).
const speedRamp = { target: null, current: null, sent: null, input: "6", timer: null };
const SPEED_MIN = 0.05, SPEED_STEP = 0.03, SPEED_TICK = 50;
function sendReplaySpeed(value) {
  speedRamp.sent = value;
  return vmixCall({ Function: "ReplaySetSpeed", Input: speedRamp.input, Channel: "Current", Value: value }).catch(() => {});
}
function stepReplaySpeed() {
  const diff = speedRamp.target - speedRamp.current;
  speedRamp.current = Math.abs(diff) <= SPEED_STEP ? speedRamp.target : speedRamp.current + Math.sign(diff) * SPEED_STEP;
  const value = Math.round(speedRamp.current * 100) / 100;
  if (value !== speedRamp.sent) sendReplaySpeed(value);
  if (speedRamp.current === speedRamp.target) { clearInterval(speedRamp.timer); speedRamp.timer = null; }
}
function setReplaySpeed({ target, input, now }) {
  if (input) speedRamp.input = String(input);
  if (target !== undefined && target !== null) speedRamp.target = Math.max(SPEED_MIN, Math.min(1, Number(target) || 1));
  if (speedRamp.target === null) return;
  if (now || speedRamp.current === null) {
    // Aplicar ya (al tirar una repe vMix usa la velocidad del evento): se manda dos veces por si vMix la pisa.
    if (speedRamp.timer) { clearInterval(speedRamp.timer); speedRamp.timer = null; }
    speedRamp.current = speedRamp.target;
    const value = Math.round(speedRamp.target * 100) / 100;
    sendReplaySpeed(value);
    if (now) setTimeout(() => sendReplaySpeed(value), 300);
    return;
  }
  if (!speedRamp.timer) speedRamp.timer = setInterval(stepReplaySpeed, SPEED_TICK);
}

// ---------- Domos (PTZ) ----------
// Se guardan por PC en data/domos.json. La clave nunca vuelve al navegador (se muestra "••••").
const domos = require("./domos");
const domosPath = path.join(root, "data", "domos.json");
const CLAVE_OCULTA = "••••";
function readDomos() {
  try {
    const data = JSON.parse(fs.readFileSync(domosPath, "utf8"));
    return { lista: Array.isArray(data.lista) ? data.lista : [], sel: Number(data.sel) || 0, paso: Number(data.paso) || 400 };
  } catch {
    return { lista: [], sel: 0, paso: 400 };
  }
}
function publicDomos() {
  const d = readDomos();
  return { ...d, marcas: domos.MARCAS, lista: d.lista.map(c => ({ ...c, clave: c.clave ? CLAVE_OCULTA : "" })) };
}
function saveDomos(body) {
  const prev = readDomos();
  const prevById = new Map(prev.lista.map(c => [c.id, c]));
  const txt = (v, max) => String(v ?? "").trim().slice(0, max);
  const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def; };
  const lista = (Array.isArray(body.lista) ? body.lista : prev.lista).slice(0, 12).map(c => {
    const id = txt(c.id, 40) || "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let clave = String(c.clave ?? "").slice(0, 100);
    if (clave === "" || clave === CLAVE_OCULTA) clave = prevById.get(id)?.clave || "";
    const marca = domos.MARCAS.includes(String(c.marca).toLowerCase()) ? String(c.marca).toLowerCase() : "foscam";
    return { id, nombre: txt(c.nombre, 40) || "Domo", marca, host: txt(c.host, 60).replace(/^https?:\/\//, "").replace(/\/.*$/, ""), puerto: num(c.puerto, 1, 65535, 88), usuario: txt(c.usuario, 40) || "admin", clave };
  });
  const next = {
    lista,
    sel: Math.max(0, Math.min(Math.max(0, lista.length - 1), num(body.sel ?? prev.sel, 0, 100, 0))),
    paso: "paso" in body ? num(body.paso, 100, 2000, 400) : prev.paso
  };
  fs.mkdirSync(path.dirname(domosPath), { recursive: true });
  fs.writeFileSync(domosPath, JSON.stringify(next, null, 2));
  return next;
}
function domoActual(idx) {
  const d = readDomos();
  const i = idx === undefined || idx === null || idx === "" ? d.sel : Number(idx);
  return { cam: d.lista[i], paso: d.paso };
}
// Los comandos a cada camara van en fila: asi un "parar" nunca llega antes que el "mover".
const domoColas = new Map();
function enColaDomo(cam, tarea) {
  const key = cam ? `${cam.host}:${cam.puerto}` : "-";
  const prev = domoColas.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(tarea);
  domoColas.set(key, next);
  return next;
}
async function domoAccion(accion, body) {
  const { cam, paso } = domoActual(body.idx);
  const dv = domos.crearDomo(cam);
  if (accion === "probar") return dv.probar();
  if (accion === "mover") return enColaDomo(cam, () => dv.mover(String(body.dir || "")));
  if (accion === "zoom") return enColaDomo(cam, () => dv.zoom(String(body.dir || "")));
  if (accion === "parar") {
    // Toque corto = un "paso": sigue moviendose hasta completar el paso elegido (corto/medio/largo).
    const falta = Math.max(0, Math.min(2000, paso - Number(body.heldMs || paso)));
    return enColaDomo(cam, async () => {
      if (falta > 0) await new Promise(resolve => setTimeout(resolve, falta));
      await dv.parar();
    });
  }
  if (accion === "preset") {
    const n = Math.max(1, Math.min(6, Number(body.n) || 1));
    return enColaDomo(cam, () => body.accion === "guardar" ? dv.guardarPreset(n) : dv.irPreset(n));
  }
  throw new Error("Acción de domo desconocida");
}

const midiConfigPath = path.join(root, "data", "midi.json");

function readMidiConfig() {
  try {
    return JSON.parse(fs.readFileSync(midiConfigPath, "utf8"));
  } catch {
    return {};
  }
}

// ---------- Upcoming desde el fixture ----------
function normName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function localDate(now) {
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function minutesOf(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function teamShort(state, name) {
  const team = (state.excel?.teams || []).find(item => normName(item.name) === normName(name));
  return team?.short || "";
}

function upcomingFromFixture(state, options = {}) {
  const fixture = Array.isArray(state.excel?.fixture) ? state.excel.fixture : [];
  if (!fixture.length) throw new Error("No hay fixture. Cargá la hoja FIXTURE en el Excel y apretá Sync Excel.");
  const diamond = String(state.upcoming?.diamond || "").trim();
  const now = options.now || new Date();
  const today = localDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let games = fixture
    .map((game, index) => ({ ...game, index, minutes: minutesOf(game.time) }))
    .filter(game => !diamond || normName(game.diamond) === normName(diamond))
    .filter(game => !game.date || game.date === today)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.minutes ?? 9999) - (b.minutes ?? 9999) || a.index - b.index);

  if (!games.length) throw new Error(diamond ? `No hay partidos de hoy en el diamante ${diamond}.` : "No hay partidos de hoy en el fixture.");

  // 1) Si el partido actual (Teams & Score) esta en el fixture, se toman los que siguen.
  const home = normName(state.match.teams.home.name);
  const away = normName(state.match.teams.away.name);
  const currentIndex = games.findIndex(game => {
    const pair = [normName(game.home), normName(game.away)];
    return pair.includes(home) && pair.includes(away);
  });
  let next;
  let mode;
  if (currentIndex >= 0) {
    next = games.slice(currentIndex + 1);
    mode = "partido actual";
  } else {
    // 2) Si no, los que todavia no empezaron segun la hora de la PC.
    next = games.filter(game => game.minutes === null || game.minutes > nowMinutes);
    mode = `hora de la PC (${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")})`;
  }
  if (!next.length) throw new Error(`No quedan partidos después (${mode}${diamond ? `, diamante ${diamond}` : ""}).`);

  const count = Math.max(1, Math.min(3, Number(state.upcoming.count || 3)));
  const labels = ["Próximo", "Luego", "Después"];
  const chosen = next.slice(0, count);
  state.upcoming.games = [0, 1, 2].map(i => {
    const game = chosen[i];
    const previous = state.upcoming.games?.[i] || {};
    if (!game) return { away: "", home: "", time: "", court: "", round: previous.round || "", status: "" };
    return {
      away: game.away,
      home: game.home,
      awayShort: teamShort(state, game.away),
      homeShort: teamShort(state, game.home),
      time: game.time,
      court: game.diamond || diamond,
      round: previous.round || "",
      status: labels[i]
    };
  });
  state.upcoming.count = String(Math.max(1, chosen.length));
  return { state, mode, loaded: chosen.length };
}

function handleLogoDelete(req, res) {
  // Borra TODOS los logos de la carpeta Logos y deja los equipos sin logo.
  try {
    const dir = logosDir();
    let deleted = 0;
    for (const file of fs.readdirSync(dir)) {
      if (imageExtensions.has(path.extname(file).toLowerCase())) {
        fs.unlinkSync(path.join(dir, file));
        deleted += 1;
      }
    }
    const state = readState();
    state.match.teams.away.logo = "";
    state.match.teams.home.logo = "";
    writeState(state);
    const next = readState();
    broadcast(next);
    sendJson(res, { ok: true, deleted, logos: listLogos(), state: next });
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 400);
  }
}

function serveLogo(res, urlPath) {
  const name = decodeURIComponent(urlPath.slice("/logos/".length));
  const dir = logosDir();
  const file = path.resolve(dir, name);
  if (!file.startsWith(path.resolve(dir) + path.sep) || !imageExtensions.has(path.extname(file).toLowerCase())) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}

function qrSvg(text) {
  const QRCode = require("./vendor/QRCode");
  const QRErrorCorrectLevel = require("./vendor/QRCode/QRErrorCorrectLevel");
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const quiet = 3;
  let cells = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col)) cells += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  const total = size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${cells}" fill="#000"/></svg>`;
}

function lanAddresses() {
  const list = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) list.push({ name, address: entry.address });
    }
  }
  return list;
}

function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const requested = clean === "/" ? "/control.html" : clean;
  const file = path.resolve(path.join(publicRoot, requested));
  return file.startsWith(publicRoot) ? file : null;
}

function handleStatePost(req, res) {
  let raw = "";
  req.on("data", chunk => raw += chunk);
  req.on("end", () => {
    try {
      const state = JSON.parse(raw || "{}");
      writeState(state);
      broadcast(state);
      sendJson(res, { ok: true, state });
    } catch (error) {
      sendJson(res, { ok: false, error: error.message }, 400);
    }
  });
}

function isHttpServiceRunning(port, requestPath = "/") {
  return new Promise((resolve) => {
    const checkReq = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path: requestPath,
        timeout: 900
      },
      (checkRes) => {
        checkRes.resume();
        resolve(checkRes.statusCode >= 200 && checkRes.statusCode < 500);
      }
    );

    checkReq.on("timeout", () => {
      checkReq.destroy();
      resolve(false);
    });
    checkReq.on("error", () => resolve(false));
    checkReq.end();
  });
}

async function openReplayPanel(res) {
  try {
    const url = `http://localhost:${replayPanelPort}/`;
    if (!fs.existsSync(electronPath)) {
      sendJson(res, { ok: false, error: `No encuentro Electron: ${electronPath}` }, 404);
      return;
    }

    const child = childProcess.spawn(electronPath, [replayKioskPath], {
      cwd: root,
      env: {
        ...process.env,
        REPLAY_PANEL_ROOT: replayPanelRoot,
        REPLAY_PANEL_PORT: String(replayPanelPort)
      },
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
    sendJson(res, { ok: true, mode: "kiosk", url });
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}

function readExcelData() {
  return new Promise((resolve, reject) => {
    const script = path.join(root, "excel_import.py");
    const excel = getExcelPath().path;
    if (!fs.existsSync(excel)) {
      reject(new Error(`No encuentro el Excel en ${excel}. Elegí la ruta o subilo desde el panel (arriba, "Excel").`));
      return;
    }
    childProcess.execFile(pythonPath, [script, excel], { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        const text = `${stderr || ""} ${error.message || ""}`;
        if (error.code === "ENOENT" || /not recognized|no se reconoce|cannot find|was not found/i.test(text)) {
          reject(new Error("No encuentro Python en esta PC. Instalalo desde python.org (tildá \"Add to PATH\") y reiniciá el panel."));
        } else if (/No module named ['"]?openpyxl/i.test(text)) {
          reject(new Error("Falta la librería openpyxl. Abrí una consola y corré: python -m pip install openpyxl (o ejecutá INSTALAR.cmd)."));
        } else if (/Permission denied|PermissionError/i.test(text)) {
          reject(new Error("No pude abrir el Excel: puede estar abierto y bloqueado. Cerralo y volvé a intentar."));
        } else {
          reject(new Error(stderr || error.message));
        }
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

function applyExcelToState(state, excel) {
  state = normalizeState(state);
  state.rosters.home.playersText = excel.homeText;
  state.rosters.away.playersText = excel.awayText;
  state.umpires.crewText = excel.umpiresText;
  if (excel.lineupHome?.length) state.lineups.home.text = excel.lineupHomeText;
  if (excel.lineupAway?.length) state.lineups.away.text = excel.lineupAwayText;
  state.excel = {
    source: excel.source,
    updatedAt: new Date().toISOString(),
    home: excel.home,
    away: excel.away,
    umpires: excel.umpires,
    teams: excel.teams || [],
    fixture: excel.fixture || [],
    diamonds: excel.diamonds || [],
    lineupHome: excel.lineupHome || [],
    lineupAway: excel.lineupAway || []
  };

  const side = state.player.teamSide === "away" ? "away" : "home";
  const currentPlayerStillExists = excel[side]?.some(row => (
    String(row.number) === String(state.player.number) && row.name === state.player.name
  ));
  const firstPlayer = excel[side]?.find(row => String(row.role || "").toLowerCase() !== "head coach") || excel[side]?.[0];
  if (firstPlayer && (!state.player.name || !currentPlayerStillExists)) {
    state.player.number = firstPlayer.number;
    state.player.name = firstPlayer.name;
    state.player.detail = state.match.teams[side].name || firstPlayer.role;
  }

  return state;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ---------- Reglas de softball (fastpitch WBSC) ----------
// TOP: batea el visitante (away). BOTTOM: batea el local (home).

function battingSide(match) {
  return match.half === "BOTTOM" ? "home" : "away";
}

function fieldingSide(match) {
  return match.half === "BOTTOM" ? "away" : "home";
}

function normalizeLine(team, inning) {
  const requiredLength = Math.max(Number(inning || 1), 1);
  team.line = Array.isArray(team.line) ? team.line.map(value => Number(value) || 0) : [];
  while (team.line.length < requiredLength) team.line.push(0);
  return team.line;
}

function changeTeamScoreForInning(team, inning, delta) {
  const line = normalizeLine(team, inning);
  const index = Math.max(0, Number(inning || 1) - 1);
  const next = Math.max(0, Number(line[index] || 0) + delta);
  const applied = next - Number(line[index] || 0);
  line[index] = next;
  team.score = Math.max(0, Number(team.score || 0) + applied);
}

function resetCount(match) {
  match.balls = 0;
  match.strikes = 0;
}

function tiebreakStart(match) {
  return Number(match.tiebreakInning) || (Number(match.regulationInnings || 7) + 1);
}

function startHalf(match) {
  match.outs = 0;
  match.bases = { first: false, second: false, third: false };
  resetCount(match);
  // Tie-breaker WBSC: desde la entrada 8 cada mitad arranca con corredor en segunda.
  if (match.autoTiebreak !== false && Number(match.inning) >= tiebreakStart(match)) {
    match.bases.second = true;
  }
}

function changeSide(match) {
  if (match.half === "TOP") {
    match.half = "BOTTOM";
  } else {
    match.half = "TOP";
    match.inning = Number(match.inning || 1) + 1;
  }
  startHalf(match);
}

function addOut(match) {
  resetCount(match);
  if (Number(match.outs || 0) >= 2) {
    changeSide(match);
    return;
  }
  match.outs = Number(match.outs || 0) + 1;
}

function walk(match) {
  // Base por bolas / golpeado: avanzan solo los corredores forzados.
  const bases = match.bases;
  if (bases.first && bases.second && bases.third) {
    changeTeamScoreForInning(match.teams[battingSide(match)], match.inning, 1);
  } else if (bases.first && bases.second) {
    bases.third = true;
  } else if (bases.first) {
    bases.second = true;
  }
  bases.first = true;
  resetCount(match);
}

function addBall(match) {
  if (Number(match.balls || 0) >= 3) walk(match);
  else match.balls = Number(match.balls || 0) + 1;
}

function addStrike(match) {
  if (Number(match.strikes || 0) >= 2) addOut(match);
  else match.strikes = Number(match.strikes || 0) + 1;
}

function addFoul(match) {
  // Foul: suma strike solo si hay menos de 2.
  if (Number(match.strikes || 0) < 2) match.strikes = Number(match.strikes || 0) + 1;
}

function resetGame(match) {
  match.inning = 1;
  match.half = "TOP";
  for (const team of [match.teams.away, match.teams.home]) {
    team.score = 0;
    team.hits = 0;
    team.errors = 0;
    team.line = [];
  }
  startHalf(match);
}

function applyGameAction(state, action) {
  const match = state.match;
  const away = match.teams.away;
  const home = match.teams.home;
  const batting = match.teams[battingSide(match)];
  const fielding = match.teams[fieldingSide(match)];

  switch (action) {
    case "away-plus": changeTeamScoreForInning(away, match.inning, 1); break;
    case "away-minus": changeTeamScoreForInning(away, match.inning, -1); break;
    case "home-plus": changeTeamScoreForInning(home, match.inning, 1); break;
    case "home-minus": changeTeamScoreForInning(home, match.inning, -1); break;
    case "run-plus": changeTeamScoreForInning(batting, match.inning, 1); break;
    case "run-minus": changeTeamScoreForInning(batting, match.inning, -1); break;
    case "ball-plus": addBall(match); break;
    case "ball-minus": match.balls = clamp(Number(match.balls || 0) - 1, 0, 3); break;
    case "strike-plus": addStrike(match); break;
    case "strike-minus": match.strikes = clamp(Number(match.strikes || 0) - 1, 0, 2); break;
    case "foul": addFoul(match); break;
    case "count-reset": resetCount(match); break;
    case "walk": walk(match); break;
    case "out-plus": addOut(match); break;
    case "out-minus": match.outs = clamp(Number(match.outs || 0) - 1, 0, 2); break;
    case "outs-clear": match.outs = 0; break;
    case "hit-plus": batting.hits = Number(batting.hits || 0) + 1; resetCount(match); break;
    case "hit-minus": batting.hits = Math.max(0, Number(batting.hits || 0) - 1); break;
    case "error-plus": fielding.errors = Number(fielding.errors || 0) + 1; break;
    case "error-minus": fielding.errors = Math.max(0, Number(fielding.errors || 0) - 1); break;
    case "change-side": changeSide(match); break;
    case "inning-plus": match.inning = Number(match.inning || 1) + 1; break;
    case "inning-minus": match.inning = Math.max(1, Number(match.inning || 1) - 1); break;
    case "half-toggle": match.half = match.half === "TOP" ? "BOTTOM" : "TOP"; break;
    case "base-first": match.bases.first = !match.bases.first; break;
    case "base-second": match.bases.second = !match.bases.second; break;
    case "base-third": match.bases.third = !match.bases.third; break;
    case "bases-clear": match.bases = { first: false, second: false, third: false }; break;
    case "game-reset": resetGame(match); break;
    default: return false;
  }
  return true;
}

function applyScorebugAction(state, action) {
  state = normalizeState(state);
  if (applyGameAction(state, action)) return state;
  if (applyAdAction(state, action)) return state;

  if (action === "scorebug-in") {
    state.ndi.activeGraphic = "scorebug";
    state.ndi.scorebugVisible = true;
    state.ndi.visible = true;
  } else if (action === "scorebug-out") {
    state.ndi.scorebugVisible = false;
    if (state.ndi.activeGraphic === "scorebug") {
      state.ndi.visible = Boolean(state.ndi.playerVisible);
      if (state.ndi.playerVisible) state.ndi.activeGraphic = "player";
    }
  } else {
    throw new Error(`Unknown scorebug action: ${action}`);
  }
  return state;
}


function createServer() {
  ensureState();
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, readState());
    }

    if (req.method === "GET" && url.pathname === "/api/excel-data") {
      (async () => {
        try {
          sendJson(res, { ok: true, data: await readExcelData() });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 500);
        }
      })();
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import-excel") {
      (async () => {
        try {
          const state = applyExcelToState(readState(), await readExcelData());
          writeState(state);
          broadcast(state);
          sendJson(res, { ok: true, state });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 500);
        }
      })();
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/state") {
      return handleStatePost(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/replay/open") {
      return openReplayPanel(res);
    }

    if (req.method === "GET" && url.pathname === "/api/domos") {
      return sendJson(res, { ok: true, domos: publicDomos() });
    }

    if (req.method === "GET" && url.pathname === "/domo/snap") {
      (async () => {
        const { cam } = domoActual(url.searchParams.get("idx"));
        const dv = domos.crearDomo(cam);
        const shot = await domos.httpGet(dv.snapshotUrl(), 6000);
        const type = String(shot.headers["content-type"] || "");
        if (shot.status !== 200 || !type.startsWith("image/")) throw new Error("La cámara no devolvió imagen (revisá usuario y clave)");
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
        res.end(shot.body);
      })().catch(error => sendJson(res, { ok: false, error: error.message }, 502));
      return;
    }

    if (req.method === "POST" && (url.pathname === "/api/domos" || url.pathname.startsWith("/api/domo/"))) {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", async () => {
        try {
          const body = JSON.parse(raw || "{}");
          if (url.pathname === "/api/domos") {
            saveDomos(body);
            return sendJson(res, { ok: true, domos: publicDomos() });
          }
          const result = await domoAccion(url.pathname.slice("/api/domo/".length), body);
          sendJson(res, { ok: true, ...(result || {}) });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 502);
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/replay-speed") {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", () => {
        try {
          setReplaySpeed(JSON.parse(raw || "{}"));
          sendJson(res, { ok: true, target: speedRamp.target });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 400);
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vmix") {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", async () => {
        try {
          const body = JSON.parse(raw || "{}");
          if (body.ping) {
            const result = await vmixCall({});
            const version = (/<version>([^<]*)/.exec(result.body) || [])[1] || "";
            const active = (/<active>([^<]*)/.exec(result.body) || [])[1] || "";
            return sendJson(res, { ok: result.status === 200, version, active });
          }
          const calls = Array.isArray(body.calls) ? body.calls : [body];
          const results = [];
          for (const call of calls) {
            if (!call.Function) throw new Error("Falta Function");
            const { _delay, ...params } = call;   // _delay: esperar (ms) antes de esta llamada
            if (_delay) await new Promise(resolve => setTimeout(resolve, Math.min(10000, Number(_delay) || 0)));
            results.push(await vmixCall(params));
          }
          const failed = results.find(result => result.status !== 200);
          sendJson(res, { ok: !failed, results, error: failed ? failed.body : undefined }, failed ? 502 : 200);
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 502);
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/vmix-settings") {
      return sendJson(res, { ok: true, ...vmixSettings() });
    }

    if (req.method === "POST" && url.pathname === "/api/vmix-settings") {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", () => {
        try {
          const body = JSON.parse(raw || "{}");
          const config = readConfig();
          config.vmixHost = String(body.host || "127.0.0.1").trim();
          config.vmixPort = Number(body.port || 8088);
          writeConfig(config);
          sendJson(res, { ok: true, ...vmixSettings() });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 400);
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/midi") {
      return sendJson(res, { ok: true, config: readMidiConfig() });
    }

    if (req.method === "POST" && url.pathname === "/api/midi") {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", () => {
        try {
          const config = JSON.parse(raw || "{}");
          fs.mkdirSync(path.dirname(midiConfigPath), { recursive: true });
          fs.writeFileSync(midiConfigPath, JSON.stringify(config, null, 2));
          sendJson(res, { ok: true });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 400);
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ads") {
      const state = readState();
      const catalog = refreshAdFiles(state);
      writeState(state);
      broadcast(readState());
      return sendJson(res, { ok: true, ...catalog });
    }

    if (req.method === "POST" && url.pathname === "/api/ads-folder") {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", () => {
        try {
          const target = String(JSON.parse(raw || "{}").path || "").trim().replace(/^"+|"+$/g, "");
          const config = readConfig();
          if (!target) delete config.adsFolder;
          else {
            if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error(`No existe la carpeta: ${target}`);
            config.adsFolder = path.resolve(target);
          }
          writeConfig(config);
          const state = readState();
          const catalog = refreshAdFiles(state);
          writeState(state);
          broadcast(readState());
          sendJson(res, { ok: true, ...catalog });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 400);
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/ads/")) {
      return serveAd(res, url.pathname);
    }

    if (req.method === "GET" && url.pathname === "/api/excel-info") {
      const info = getExcelPath();
      return sendJson(res, { ok: true, path: info.path, source: info.source, exists: fs.existsSync(info.path) });
    }

    if (req.method === "POST" && url.pathname === "/api/excel-path") {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end", () => {
        try {
          const body = JSON.parse(raw || "{}");
          const target = String(body.path || "").trim().replace(/^"+|"+$/g, "");
          const config = readConfig();
          if (!target) {
            delete config.excelPath;
          } else {
            if (!/\.xlsx$/i.test(target)) throw new Error("Tiene que ser un archivo .xlsx");
            if (!fs.existsSync(target)) throw new Error(`No existe: ${target}`);
            config.excelPath = path.resolve(target);
          }
          writeConfig(config);
          const info = getExcelPath();
          sendJson(res, { ok: true, path: info.path, source: info.source, exists: fs.existsSync(info.path) });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 400);
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/excel-upload") {
      const chunks = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", () => {
        try {
          const buffer = Buffer.concat(chunks);
          if (buffer.length < 100 || buffer.slice(0, 2).toString() !== "PK") throw new Error("No parece un archivo .xlsx válido.");
          const target = getExcelPath().path;
          if (fs.existsSync(target)) fs.copyFileSync(target, target.replace(/\.xlsx$/i, " (anterior).xlsx"));
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, buffer);
          sendJson(res, { ok: true, path: target, exists: true });
        } catch (error) {
          sendJson(res, { ok: false, error: error.message }, 400);
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/logos") {
      try {
        return sendJson(res, { ok: true, folder: logosDir(), logos: listLogos() });
      } catch (error) {
        return sendJson(res, { ok: false, error: error.message }, 500);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/logos/upload") {
      return handleLogoUpload(req, res, url);
    }

    if (req.method === "POST" && url.pathname === "/api/upcoming/from-fixture") {
      try {
        const result = upcomingFromFixture(readState());
        writeState(result.state);
        const next = readState();
        broadcast(next);
        return sendJson(res, { ok: true, mode: result.mode, loaded: result.loaded, state: next });
      } catch (error) {
        return sendJson(res, { ok: false, error: error.message }, 400);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/logos/delete") {
      return handleLogoDelete(req, res);
    }

    if (req.method === "GET" && url.pathname.startsWith("/logos/")) {
      return serveLogo(res, url.pathname);
    }

    if (req.method === "GET" && url.pathname === "/api/network") {
      return sendJson(res, { ok: true, host: os.hostname(), port: Number(req.socket.localPort), addresses: lanAddresses() });
    }

    if (req.method === "GET" && url.pathname === "/api/qr.svg") {
      try {
        const svg = qrSvg(String(url.searchParams.get("text") || "").slice(0, 200));
        res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
        res.end(svg);
      } catch (error) {
        res.writeHead(400);
        res.end(error.message);
      }
      return;
    }

    if (req.method === "GET" && (url.pathname === "/m" || url.pathname === "/movil")) {
      res.writeHead(302, { Location: "/mobile.html" });
      res.end();
      return;
    }

    if ((req.method === "GET" || req.method === "POST") && url.pathname.startsWith("/api/scorebug/")) {
      try {
        const action = decodeURIComponent(url.pathname.slice("/api/scorebug/".length));
        let state;
        if (action === "undo") {
          const previous = undoStack.pop();
          if (!previous) throw new Error("Nada para deshacer.");
          state = normalizeState(JSON.parse(previous));
        } else {
          const current = readState();
          const snapshot = JSON.stringify(current);
          state = applyScorebugAction(current, action);
          undoStack.push(snapshot);
          if (undoStack.length > 30) undoStack.shift();
        }
        writeState(state);
        broadcast(state);
        sendJson(res, { ok: true, action, state });
      } catch (error) {
        sendJson(res, { ok: false, error: error.message }, 400);
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "Connection": "keep-alive"
      });
      clients.add(res);
      res.write(`data: ${JSON.stringify(readState())}\n\n`);
      req.on("close", () => clients.delete(res));
      return;
    }

    const file = safeFile(url.pathname);
    if (!file) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(data);
    });
  });
}

if (process.argv.includes("--check")) {
  ensureState();
  console.log("OK: Softball NDI server files are ready.");
} else if (require.main === module) {
  const port = Number(process.env.PORT || 8136);
  createServer().listen(port, () => {
    console.log(`Softball NDI Panel: http://localhost:${port}/control.html`);
    console.log(`Softball NDI Scorebug: http://localhost:${port}/scorebug.html`);
  });
}

module.exports = { createServer, readState };
