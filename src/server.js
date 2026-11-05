const http = require("http");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const dataRoot = path.join(root, "data");
const statePath = path.join(dataRoot, "state.json");
const excelPath = process.env.SB_EXCEL || "C:\\Users\\claud\\Videos\\Softball2026\\Datos.xlsx";
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
  ".png": "image/png"
};

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
  match.tiebreakInning = Number(match.tiebreakInning || 8);
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
  state.upcoming.games ||= [];
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
    childProcess.execFile(pythonPath, [script, excelPath], { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
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
  state.excel = {
    source: excel.source,
    updatedAt: new Date().toISOString(),
    home: excel.home,
    away: excel.away,
    umpires: excel.umpires
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

function startHalf(match) {
  match.outs = 0;
  match.bases = { first: false, second: false, third: false };
  resetCount(match);
  // Tie-breaker WBSC: desde la entrada 8 cada mitad arranca con corredor en segunda.
  if (match.autoTiebreak !== false && Number(match.inning) >= Number(match.tiebreakInning || 8)) {
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

    if ((req.method === "GET" || req.method === "POST") && url.pathname.startsWith("/api/scorebug/")) {
      try {
        const action = decodeURIComponent(url.pathname.slice("/api/scorebug/".length));
        const state = applyScorebugAction(readState(), action);
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
