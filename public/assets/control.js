let state = null;
let saveTimer = null;
let monitorOverride = null;
let events = null;

const fields = [...document.querySelectorAll("[data-path]")];
const statusEl = document.getElementById("status");
const playerPicker = document.getElementById("player-picker");
const baseToggles = [...document.querySelectorAll("[data-base-toggle]")];
const countPill = document.getElementById("count-pill");
const staffRole = /coach|manager|dt|delegad|asistente|entrenador/i;
const teamLogoOptions = [
  { value: "", label: "No logo" },
  {
    value: "assets/logos/cultural-avellaneda.png",
    label: "Club Avellaneda",
    name: "Club Avellaneda",
    short: "AVE",
    color: "#e42f25"
  },
  {
    value: "assets/logos/ncm.png",
    label: "Midland",
    name: "Midland",
    short: "MID",
    color: "#123f9d"
  },
  {
    value: "assets/logos/club-winners.png",
    label: "El Propio - Winners",
    name: "El Propio - Winners",
    short: "WIN",
    color: "#173b7a"
  },
  {
    value: "assets/logos/club-san-pedro.png",
    label: "Club San Pedro",
    name: "Club San Pedro",
    short: "SP",
    color: "#20a8b4"
  }
];
let currentTab = "scorebug";
const LINEUP_SLOTS = 10; // 9 bateadores + FLEX
const POSITIONS = ["", "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DP", "EP"];

const graphics = {
  scorebug: { label: "Scorebug" },
  scoreboard: { label: "Scoreboard" },
  matchup: { label: "Matchup" },
  rosterAway: { label: "Away Roster" },
  rosterHome: { label: "Home Roster" },
  umpires: { label: "Umpires" },
  player: { label: "Player" },
  commentators: { label: "Commentators" },
  upcoming: { label: "Upcoming" },
  lineupAway: { label: "Away Line up" },
  lineupHome: { label: "Home Line up" },
  defense: { label: "Defensa" }
};
const tabPreviewGraphic = {
  scorebug: "scorebug",
  scoreboard: "scoreboard",
  matchup: "matchup",
  rosters: "rosterHome",
  umpires: "umpires",
  player: "player",
  commentators: "commentators",
  upcoming: "upcoming",
  lineup: "lineupHome",
  defense: "defense"
};
const openReplayPanelButton = document.getElementById("open-replay-panel");
const openRenderLink = document.getElementById("open-render");
const previewMonitor = document.getElementById("preview-monitor");
const previewFrame = document.getElementById("preview-frame");
const previewClose = document.getElementById("preview-close");
const previewTitle = document.getElementById("preview-monitor-title");

document.querySelectorAll("[data-url]").forEach(element => {
  element.textContent = `${location.origin}/graphics.html`;
});

document.querySelectorAll('select[data-path$=".logo"]').forEach(select => {
  select.innerHTML = teamLogoOptions
    .map(option => `<option value="${option.value}">${option.label}</option>`)
    .join("");
});

document.querySelectorAll("[data-overlay-in]").forEach(button => button.textContent = "In");
document.querySelectorAll("[data-overlay-out]").forEach(button => button.textContent = "Out");
document.querySelectorAll("[data-path^='vmix.']").forEach(field => {
  const label = field.closest("label");
  if (label) label.style.display = "none";
});
document.querySelectorAll("h2").forEach(title => {
  if (title.textContent.includes("vMix Setup")) title.textContent = title.textContent.replace("vMix Setup", "NDI Output");
});

document.querySelectorAll("[data-window-action]").forEach(button => {
  button.addEventListener("click", () => {
    const api = window.b5PanelWindow;
    if (!api) {
      setStatus("Window controls are available in kiosk panel mode.", true);
      return;
    }
    const action = button.dataset.windowAction;
    if (action === "prev") api.movePrev();
    if (action === "next") api.moveNext();
    if (action === "fullscreen") api.toggleFullscreen();
    if (action === "close") api.close();
  });
});

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function getPath(object, path) {
  return path.split(".").reduce((acc, part) => acc?.[part], object);
}

function setPath(object, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce((acc, part) => {
    if (!acc[part] || typeof acc[part] !== "object") acc[part] = {};
    return acc[part];
  }, object);
  target[last] = value;
}

function parseValue(path, value, type) {
  if (type === "number") return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  if (path.endsWith(".line")) {
    return String(value).split(",").map(item => Number(item.trim()) || 0);
  }
  return value;
}

function formatValue(path, value) {
  if (value === undefined || value === null) return "";
  if (path === "match.tiebreakInning" && !Number(value)) return "";
  if (typeof value === "boolean") return String(value);
  if (path.endsWith(".line") && Array.isArray(value)) return value.join(",");
  return value;
}

function ensureStateDefaults() {
  state.event ||= { name: "Softball 2026", status: "LIVE" };
  state.match ||= {};
  const match = state.match;
  match.gameId = String(match.gameId || "").trim();
  match.inning ||= 1;
  match.half ||= "TOP";
  match.outs ||= 0;
  match.balls ||= 0;
  match.strikes ||= 0;
  match.regulationInnings ||= 7;
  match.tiebreakInning ||= 0;
  if (match.autoTiebreak === undefined) match.autoTiebreak = true;
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
    team.score ||= 0;
    team.hits ||= 0;
    team.errors ||= 0;
    team.line ||= [];
  }
  state.scoreboard ||= { title: "LINE SCORE", subtitle: state.event.name };
  state.matchup ||= { title: "MATCHUP", subtitle: state.event.name, round: "Fase de grupos", venue: "", titleScale: 1 };
  state.rosters ||= { title: "TEAM ROSTER", subtitle: state.event.name, away: { playersText: "" }, home: { playersText: "" } };
  state.rosters.away ||= { playersText: "" };
  state.rosters.home ||= { playersText: "" };
  state.lineups ||= { title: "LINEUP", subtitle: state.event.name };
  for (const side of ["away", "home"]) {
    state.lineups[side] ||= {};
    const slots = Array.isArray(state.lineups[side].slots) ? state.lineups[side].slots : [];
    while (slots.length < LINEUP_SLOTS) slots.push({ number: "", name: "", pos: "" });
    slots.forEach((slot, index) => { slot.flex = index === LINEUP_SLOTS - 1; });
    state.lineups[side].slots = slots.slice(0, LINEUP_SLOTS);
  }
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
  state.upcoming.games ||= [];
  while (state.upcoming.games.length < 3) state.upcoming.games.push({ away: "", home: "", time: "", court: "", round: "", status: "" });
  state.ndi ||= {};
  state.ndi.sourceName ||= "B5 Scorebug";
  state.ndi.width ||= 1920;
  state.ndi.height ||= 1080;
  state.ndi.fps ||= 30;
  state.ndi.alpha = state.ndi.alpha !== false;
  state.ndi.activeGraphic ||= "scorebug";
  if (state.ndi.scorebugVisible === undefined) state.ndi.scorebugVisible = state.ndi.activeGraphic === "scorebug" && state.ndi.visible !== false;
  if (state.ndi.playerVisible === undefined) state.ndi.playerVisible = state.ndi.activeGraphic === "player" && state.ndi.visible !== false;
  if (state.ndi.visible === undefined) state.ndi.visible = true;
  state.excel ||= { home: [], away: [] };
}

function fillForm() {
  if (!state) return;
  for (const field of fields) {
    const path = field.dataset.path;
    const value = formatValue(path, getPath(state, path));
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value;
    if (path.endsWith(".logo")) renderLogoPreview(field);
  }
  fillPlayerPicker();
  renderLineupBuilders();
  renderBaseControl();
  renderCount();
  renderNdiButtons();
}

function renderLogoPreview(field) {
  if (!field.dataset.path.endsWith(".logo")) return;
  const label = field.closest("label");
  if (!label) return;
  let preview = label.querySelector(".logo-picker-preview");
  if (!preview) {
    preview = document.createElement("span");
    preview.className = "logo-picker-preview";
    label.appendChild(preview);
  }
  preview.innerHTML = field.value ? `<img src="${field.value}" alt="">` : "<b>No logo</b>";
}

function applyTeamLogoPreset(field) {
  const preset = teamLogoOptions.find(option => option.value === field.value);
  if (!preset?.name) return;
  const side = field.dataset.path.includes(".away.") ? "away" : "home";
  state.match.teams[side].name = preset.name;
  state.match.teams[side].short = preset.short;
  state.match.teams[side].color = preset.color;
  fillForm();
}

function readForm() {
  for (const field of fields) {
    const path = field.dataset.path;
    const value = field.type === "checkbox" ? field.checked : field.value;
    setPath(state, path, parseValue(path, value, field.type));
  }
}

function renderBaseControl() {
  for (const button of baseToggles) {
    const base = button.dataset.baseToggle;
    const isOn = Boolean(state.match.bases[base]);
    button.classList.toggle("on", isOn);
    button.setAttribute("aria-pressed", String(isOn));
  }
}

function rosterPlayers(side) {
  return (state.excel?.[side] || []).filter(row => String(row.name || "").trim() && !staffRole.test(String(row.role || "")));
}

function playerKey(player) {
  return `${String(player.number || "").trim()}|${String(player.name || "").trim()}`;
}

function renderLineupBuilders() {
  document.querySelectorAll("[data-lineup-side]").forEach(container => {
    if (container.contains(document.activeElement)) return;
    const side = container.dataset.lineupSide;
    const players = rosterPlayers(side);
    const slots = state.lineups[side].slots;
    container.innerHTML = slots.map((slot, index) => {
      const options = [`<option value="">-</option>`];
      const keys = new Set();
      for (const player of players) {
        const key = playerKey(player);
        keys.add(key);
        const label = player.number ? `${player.number} | ${player.name}` : player.name;
        options.push(`<option value="${escAttr(key)}" ${key === playerKey(slot) && slot.name ? "selected" : ""}>${escAttr(label)}</option>`);
      }
      if (slot.name && !keys.has(playerKey(slot))) {
        options.push(`<option value="${escAttr(playerKey(slot))}" selected>${escAttr(slot.number ? `${slot.number} | ${slot.name}` : slot.name)}</option>`);
      }
      const posOptions = POSITIONS.map(pos => `<option value="${pos}" ${pos === (slot.pos || "") ? "selected" : ""}>${pos || "Pos"}</option>`).join("");
      return `
        <div class="lineup-slot ${slot.flex ? "flex" : ""}">
          <span class="lineup-slot-order">${slot.flex ? "FLEX" : index + 1}</span>
          <select data-slot-player="${index}">${options.join("")}</select>
          <select data-slot-pos="${index}">${posOptions}</select>
        </div>`;
    }).join("");
    container.querySelectorAll("[data-slot-player]").forEach(select => select.addEventListener("change", () => {
      const slot = slots[Number(select.dataset.slotPlayer)];
      const [number = "", ...nameParts] = select.value.split("|");
      slot.number = select.value ? number : "";
      slot.name = select.value ? nameParts.join("|") : "";
      const rosterPos = players.find(player => playerKey(player) === select.value)?.role || "";
      if (select.value && !slot.pos && POSITIONS.includes(rosterPos.toUpperCase())) slot.pos = rosterPos.toUpperCase();
      scheduleSave();
      select.blur();
    }));
    container.querySelectorAll("[data-slot-pos]").forEach(select => select.addEventListener("change", () => {
      slots[Number(select.dataset.slotPos)].pos = select.value;
      scheduleSave();
      select.blur();
    }));
  });
}

function escAttr(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function renderCount() {
  if (countPill) countPill.textContent = `${Number(state.match.balls || 0)}-${Number(state.match.strikes || 0)}`;
}

function renderNdiButtons() {
  document.querySelectorAll("[data-overlay-in]").forEach(button => {
    const key = button.dataset.overlayIn;
    let isActive = state.ndi.visible && state.ndi.activeGraphic === key;
    if (key === "scorebug") isActive = Boolean(state.ndi.scorebugVisible);
    if (key === "player") isActive = Boolean(state.ndi.playerVisible);
    button.classList.toggle("active-ndi", isActive);
  });
}

function fillPlayerPicker() {
  if (!playerPicker || !state) return;
  const side = state.player.teamSide === "away" ? "away" : "home";
  const players = (state.excel?.[side] || []).filter(row => !staffRole.test(String(row.role || "")));
  playerPicker.innerHTML = "";
  if (!players.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Manual entry";
    playerPicker.appendChild(option);
    return;
  }
  for (const player of players) {
    const option = document.createElement("option");
    option.value = JSON.stringify(player);
    option.textContent = `${player.number} | ${player.name} | ${player.role}`;
    option.selected = String(player.number) === String(state.player.number) && player.name === state.player.name;
    playerPicker.appendChild(option);
  }
}

async function load() {
  const response = await fetch("/api/state", { cache: "no-store" });
  state = await response.json();
  ensureStateDefaults();
  fillForm();
  setStatus(`Loaded. NDI active: ${graphics[state.ndi.activeGraphic]?.label || state.ndi.activeGraphic}.`);
}

async function save() {
  readForm();
  ensureStateDefaults();
  const response = await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (!response.ok) throw new Error("Could not save.");
  const payload = await response.json();
  if (payload?.state) {
    state = payload.state;
    ensureStateDefaults();
    fillForm();
  }
  renderNdiButtons();
  setStatus(`Saved. NDI: ${state.ndi.visible ? graphics[state.ndi.activeGraphic]?.label : "Hidden"}.`);
}

function applyRemoteState(nextState, message = "Panel synced.") {
  if (!nextState) return;
  clearTimeout(saveTimer);
  state = nextState;
  ensureStateDefaults();
  fillForm();
  updatePreviewFrame();
  setStatus(message);
}

function connectStateEvents() {
  if (!window.EventSource || events) return;
  events = new EventSource("/events");
  events.onmessage = event => {
    try {
      applyRemoteState(JSON.parse(event.data), "Panel synced.");
    } catch (error) {
      setStatus(`Sync error: ${error.message}`, true);
    }
  };
  events.onerror = () => {
    setStatus("Panel sync reconnecting...", true);
  };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save().catch(error => setStatus(error.message, true)), 180);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function quick(action, button) {
  if (button?.dataset.confirm && !window.confirm(button.dataset.confirm)) return;
  clearTimeout(saveTimer);
  try {
    await save();
    const response = await fetch(`/api/scorebug/${encodeURIComponent(action)}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || `Action failed: ${action}`);
    applyRemoteState(payload.state, `OK: ${action}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function showGraphic(graphic) {
  readForm();
  if (graphic === "scorebug") {
    state.ndi.scorebugVisible = true;
    state.ndi.visible = true;
    if (state.ndi.activeGraphic !== "player") state.ndi.activeGraphic = "scorebug";
    fillForm();
    save().catch(error => setStatus(error.message, true));
    return;
  }
  if (graphic === "player") {
    state.ndi.playerVisible = true;
    state.ndi.visible = true;
    if (state.ndi.activeGraphic !== "scorebug") state.ndi.activeGraphic = "player";
    fillForm();
    save().catch(error => setStatus(error.message, true));
    return;
  }
  state.ndi.activeGraphic = graphic;
  state.ndi.visible = true;
  state.ndi.scorebugVisible = false;
  state.ndi.playerVisible = false;
  fillForm();
  save().catch(error => setStatus(error.message, true));
}

function hideGraphic(graphic) {
  readForm();
  if (graphic === "scorebug") {
    state.ndi.scorebugVisible = false;
    if (!state.ndi.playerVisible) state.ndi.visible = false;
    else state.ndi.activeGraphic = "player";
    fillForm();
    save().catch(error => setStatus(error.message, true));
    return;
  }
  if (graphic === "player") {
    state.ndi.playerVisible = false;
    if (!state.ndi.scorebugVisible) state.ndi.visible = false;
    else state.ndi.activeGraphic = "scorebug";
    fillForm();
    save().catch(error => setStatus(error.message, true));
    return;
  }
  if (!graphic || state.ndi.activeGraphic === graphic) state.ndi.visible = false;
  fillForm();
  save().catch(error => setStatus(error.message, true));
}

function switchTab(tab) {
  currentTab = tab;
  monitorOverride = null;
  document.querySelectorAll(".tab-btn").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab));
  updatePreviewFrame();
}

function previewUrl() {
  const previewGraphic = monitorOverride || tabPreviewGraphic[currentTab] || "scorebug";
  return `graphics.html?preview=${encodeURIComponent(previewGraphic)}`;
}

function updatePreviewFrame() {
  if (!previewMonitor || previewMonitor.hidden) return;
  const previewGraphic = monitorOverride || tabPreviewGraphic[currentTab] || "scorebug";
  previewTitle.textContent = `Preview: ${graphics[previewGraphic]?.label || previewGraphic}`;
  const nextUrl = previewUrl();
  if (!previewFrame.src.endsWith(nextUrl)) previewFrame.src = nextUrl;
}

function toggleBase(base) {
  readForm();
  state.match.bases[base] = !state.match.bases[base];
  fillForm();
  save().catch(error => setStatus(error.message, true));
}

function setPlayerFromPicker() {
  if (!playerPicker?.value) return;
  readForm();
  const player = JSON.parse(playerPicker.value);
  const side = state.player.teamSide === "away" ? "away" : "home";
  state.player.number = player.number;
  state.player.name = player.name;
  state.player.detail = state.match.teams[side].name || player.role || "";
  fillForm();
  save().catch(error => setStatus(error.message, true));
}

document.getElementById("save").addEventListener("click", () => save().catch(error => setStatus(error.message, true)));
document.getElementById("reload").addEventListener("click", () => load().catch(error => setStatus(error.message, true)));
openRenderLink?.addEventListener("click", () => {
  previewMonitor.hidden = false;
  updatePreviewFrame();
});
document.querySelectorAll("[data-monitor]").forEach(button => {
  button.addEventListener("click", () => {
    monitorOverride = button.dataset.monitor;
    previewMonitor.hidden = false;
    updatePreviewFrame();
  });
});
previewClose?.addEventListener("click", () => {
  previewMonitor.hidden = true;
  previewFrame.removeAttribute("src");
});

openReplayPanelButton?.addEventListener("click", async () => {
  try {
    if (window.b5PanelWindow?.openReplay) {
      const payload = await window.b5PanelWindow.openReplay();
      if (!payload?.ok) throw new Error(payload?.error || "Could not open Replay panel.");
      setStatus(payload.mode === "started" ? "Opening Panel Replay." : "Panel Replay opened.");
      return;
    }

    const response = await fetch("/api/replay/open", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not open Replay panel.");
    setStatus(payload.mode === "started" ? "Opening Panel Replay." : "Panel Replay opened.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

async function importExcelData() {
  clearTimeout(saveTimer);
  setStatus("Syncing Excel...");
  const response = await fetch("/api/import-excel", { method: "POST" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not import Excel data.");
  applyRemoteState(payload.state, "Excel synced. Rosters, umpires and player lists updated.");
  updatePreviewFrame();
  setStatus("Excel synced. Rosters, umpires and player lists updated.");
}

document.getElementById("import-excel-global")?.addEventListener("click", () => importExcelData().catch(error => setStatus(error.message, true)));
document.getElementById("import-excel")?.addEventListener("click", () => importExcelData().catch(error => setStatus(error.message, true)));
document.getElementById("import-excel-umpires")?.addEventListener("click", () => importExcelData().catch(error => setStatus(error.message, true)));
document.getElementById("import-excel-lineup")?.addEventListener("click", () => importExcelData().catch(error => setStatus(error.message, true)));
document.querySelectorAll("[data-lineup-clear]").forEach(button => button.addEventListener("click", () => {
  if (!window.confirm("Limpiar el line up de este equipo?")) return;
  const side = button.dataset.lineupClear;
  state.lineups[side].slots = [];
  ensureStateDefaults();
  renderLineupBuilders();
  scheduleSave();
}));
document.getElementById("import-excel-player")?.addEventListener("click", () => importExcelData().catch(error => setStatus(error.message, true)));
playerPicker?.addEventListener("change", setPlayerFromPicker);

document.querySelectorAll("[data-overlay-in]").forEach(button => {
  button.addEventListener("click", () => showGraphic(button.dataset.overlayIn));
});

document.querySelectorAll("[data-overlay-out]").forEach(button => {
  button.addEventListener("click", () => hideGraphic(button.dataset.overlayOut));
});

document.querySelectorAll(".tab-btn").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => quick(button.dataset.action, button)));
baseToggles.forEach(button => button.addEventListener("click", () => toggleBase(button.dataset.baseToggle)));

fields.forEach(field => {
  field.addEventListener("input", scheduleSave);
  field.addEventListener("change", () => {
    if (field.dataset.path.endsWith(".logo")) {
      readForm();
      applyTeamLogoPreset(field);
      renderLogoPreview(field);
    }
    if (field.dataset.path === "player.teamSide") {
      readForm();
      fillPlayerPicker();
    }
    scheduleSave();
  });
});

function showQr(link) {
  let box = document.getElementById("qr-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "qr-box";
    box.className = "qr-box";
    box.addEventListener("click", () => box.remove());
    document.body.appendChild(box);
  }
  box.innerHTML = `<div class="qr-card"><img src="/api/qr.svg?text=${encodeURIComponent(link)}" alt="QR"><b>${link}</b><span>Escanealo con el celular (tocá para cerrar)</span></div>`;
}

fetch("/api/network").then(r => r.json()).then(data => {
  const el = document.getElementById("mobile-link");
  if (!el || !data.addresses?.length) return;
  const sorted = [...data.addresses].sort((a, b) => Number(/zerotier/i.test(b.name)) - Number(/zerotier/i.test(a.name)));
  el.innerHTML = `<span>Celular (${data.host}):</span> ` + sorted.map(a => {
    const link = `http://${a.address}:${data.port}/m`;
    const tag = /zerotier/i.test(a.name) ? "ZeroTier" : a.name;
    return `<button type="button" class="mobile-qr-btn" data-link="${link}" title="${tag}"><b>${link}</b> <small>${tag}</small></button>`;
  }).join(" ");
  el.querySelectorAll(".mobile-qr-btn").forEach(button => button.addEventListener("click", () => showQr(button.dataset.link)));
}).catch(() => {});

load()
  .then(connectStateEvents)
  .catch(error => setStatus(error.message, true));

const initialTab = new URLSearchParams(location.search).get("tab");
if (initialTab && document.querySelector(`[data-panel="${initialTab}"]`)) switchTab(initialTab);
