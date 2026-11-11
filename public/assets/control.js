let state = null;
let saveTimer = null;
let monitorOverride = null;
let events = null;

const fields = [...document.querySelectorAll("[data-path]")];
const statusEl = document.getElementById("status");
const playerPicker = document.getElementById("player-picker");
const baseToggles = [...document.querySelectorAll("[data-base-toggle]")];
const countPill = document.getElementById("count-pill");
const staffRole = /coach|manager|\bdt\b|delegad|asistente|entrenador|jef[ae] de equipo|auxiliar|\baux\b|profesor|utiler/i;
let logoOptions = [{ value: "", label: "No logo" }];
let logosFolder = "";
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
  defense: { label: "Defensa" },
  adFull: { label: "Publicidad" },
  zocalo: { label: "Zócalo" }
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
  ads: "adFull",
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

function fillLogoSelects() {
  document.querySelectorAll('select[data-path$=".logo"]').forEach(select => {
    const current = state ? getPath(state, select.dataset.path) || "" : select.value;
    const options = [...logoOptions];
    if (current && !options.some(option => option.value === current)) {
      options.push({ value: current, label: `${decodeURIComponent(current.split("/").pop())} (no encontrado)` });
    }
    let lastSource = "";
    select.innerHTML = options.map(option => {
      const group = option.source && option.source !== lastSource ? `<option disabled>── Carpeta Logos ──</option>` : "";
      if (option.source) lastSource = option.source;
      return `${group}<option value="${escAttr(option.value)}">${escAttr(option.label)}</option>`;
    }).join("");
    select.value = current;
    renderLogoPreview(select);
  });
}

async function loadLogos() {
  const data = await fetch("/api/logos", { cache: "no-store" }).then(r => r.json());
  if (!data.ok) throw new Error(data.error || "No se pudieron leer los logos.");
  logosFolder = data.folder || "";
  logoOptions = [{ value: "", label: "No logo" }, ...data.logos];
  fillLogoSelects();
  document.querySelectorAll(".logo-upload-btn").forEach(button => { button.title = `Se guarda en ${logosFolder}`; });
}

function teamCatalog() {
  return Array.isArray(state?.excel?.teams) ? state.excel.teams : [];
}

function resolveLogo(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(logos|assets)\//i.test(text)) return text;
  const lower = text.toLowerCase();
  const match = logoOptions.find(option => option.file && (option.file.toLowerCase() === lower || option.label.toLowerCase() === lower || option.file.toLowerCase().startsWith(`${lower}.`)));
  return match ? match.value : "";
}

function fillTeamPresetSelects() {
  const teams = teamCatalog();
  document.querySelectorAll("[data-team-preset]").forEach(select => {
    const side = select.dataset.teamPreset;
    const currentName = state.match.teams[side].name;
    select.innerHTML = `<option value="">${teams.length ? "Elegir equipo…" : "Sin hoja EQUIPOS en el Excel"}</option>` +
      teams.map((team, index) => `<option value="${index}" ${team.name === currentName ? "selected" : ""}>${escAttr(team.name)}${team.short ? ` (${escAttr(team.short)})` : ""}</option>`).join("");
  });
}

function applyTeamPreset(side, index) {
  const team = teamCatalog()[Number(index)];
  if (!team) return;
  readForm();
  const target = state.match.teams[side];
  target.name = team.name;
  if (team.short) target.short = team.short;
  if (/^#[0-9a-f]{3,6}$/i.test(team.color || "")) target.color = team.color;
  const logo = resolveLogo(team.logo);
  if (logo) target.logo = logo;
  else if (team.logo) setStatus(`No encontré el logo "${team.logo}" en la carpeta Logos.`, true);
  fillForm();
  scheduleSave();
}

async function uploadLogo(side) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      setStatus(`Subiendo ${file.name}...`);
      const response = await fetch(`/api/logos/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "No se pudo subir el logo.");
      logoOptions = [{ value: "", label: "No logo" }, ...payload.logos];
      readForm();
      state.match.teams[side].logo = payload.value;
      fillForm();
      await save();
      setStatus(`Logo guardado en la carpeta Logos y asignado a ${state.match.teams[side].name}.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  input.click();
}

async function deleteAllLogos() {
  const response = await fetch("/api/logos/delete", { method: "POST" });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "No se pudieron borrar los logos.");
  logoOptions = [{ value: "", label: "No logo" }, ...payload.logos];
  applyRemoteState(payload.state, "");
  setStatus(`Logos borrados (${payload.deleted}). Ya podés subir los del nuevo torneo.`);
}

document.getElementById("logos-clear")?.addEventListener("click", () => {
  const count = logoOptions.filter(item => item.file).length;
  if (!count) {
    setStatus("No hay logos para borrar.");
    return;
  }
  if (!window.confirm(`Borrar los ${count} logos? Se eliminan de la carpeta Logos y los equipos quedan sin logo.`)) return;
  deleteAllLogos().catch(error => setStatus(error.message, true));
});

document.querySelectorAll("[data-team-preset]").forEach(select => select.addEventListener("change", () => applyTeamPreset(select.dataset.teamPreset, select.value)));
document.querySelectorAll("[data-logo-upload]").forEach(button => button.addEventListener("click", event => {
  event.preventDefault();
  uploadLogo(button.dataset.logoUpload);
}));

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
    if (!String(value).trim()) return [];
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
  fillLogoSelects();
  fillTeamPresetSelects();
  fillDiamondSelect();
  renderAds(true);
  fillPlayerPicker();
  renderLineupBuilders();
  renderTeamTags();
  renderBaseControl();
  renderCount();
  renderNdiButtons();
}

// Nombre, logo y color del equipo elegido en los titulos de Rosters y Line up.
function renderTeamTags() {
  for (const tag of document.querySelectorAll("[data-team-tag]")) {
    const side = tag.dataset.teamTag;
    const nameField = document.querySelector(`[data-path="match.teams.${side}.name"]`);
    const team = state?.match?.teams?.[side] || {};
    const name = (nameField?.value ?? team.name ?? "").trim();
    const players = (state?.excel?.[side] || []).filter(row => String(row.name || "").trim() && !staffRole.test(String(row.role || ""))).length;
    tag.style.setProperty("--tag-color", team.color || "#4b535c");
    tag.innerHTML = name
      ? `${team.logo ? `<img src="${escAttr(team.logo)}" alt="">` : ""}<b>${escAttr(name)}</b>${players ? `<small>${players} jugadores</small>` : ""}`
      : `<b>sin equipo</b>`;
  }
}
document.querySelectorAll('[data-path="match.teams.home.name"], [data-path="match.teams.away.name"]').forEach(field => field.addEventListener("input", renderTeamTags));

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
  // Si el logo elegido pertenece a un equipo de la hoja EQUIPOS, completa nombre, sigla y color.
  const index = teamCatalog().findIndex(team => team.logo && resolveLogo(team.logo) === field.value);
  if (index < 0) return;
  const side = field.dataset.path.includes(".away.") ? "away" : "home";
  applyTeamPreset(side, index);
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

function fillDiamondSelect() {
  const select = document.getElementById("diamond-select");
  if (!select) return;
  const diamonds = Array.isArray(state.excel?.diamonds) ? state.excel.diamonds : [];
  const current = state.upcoming?.diamond || "";
  const list = current && !diamonds.includes(current) ? [...diamonds, current] : diamonds;
  select.innerHTML = `<option value="">${diamonds.length ? "Elegir…" : "Sin hoja DIAMANTES"}</option>` +
    list.map(name => `<option value="${escAttr(name)}">${escAttr(name)}</option>`).join("");
  select.value = current;
  const hint = document.getElementById("fixture-hint");
  if (hint) {
    const total = Array.isArray(state.excel?.fixture) ? state.excel.fixture.length : 0;
    hint.textContent = total
      ? `${total} partidos en el fixture. Toma los que siguen al partido actual (Teams & Score) o, si no está, según la hora de la PC.`
      : "Cargá la hoja FIXTURE en el Excel y apretá Sync Excel.";
  }
}

async function loadUpcomingFromFixture() {
  clearTimeout(saveTimer);
  await save();
  const response = await fetch("/api/upcoming/from-fixture", { method: "POST" });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "No se pudo cargar el fixture.");
  applyRemoteState(payload.state, "");
  setStatus(`Upcoming: ${payload.loaded} partido(s) cargados del fixture (según ${payload.mode}).`);
}

async function refreshExcelInfo() {
  const el = document.getElementById("excel-path");
  if (!el) return;
  const info = await fetch("/api/excel-info", { cache: "no-store" }).then(r => r.json());
  el.innerHTML = `Excel <b class="${info.exists ? "ok" : "bad"}">${info.exists ? "✓" : "✗ no encontrado"}</b> <code>${escAttr(info.path)}</code> <small>(${escAttr(info.source)})</small>`;
}

document.getElementById("excel-change")?.addEventListener("click", async () => {
  const value = window.prompt("Ruta completa del Excel (en el Explorador: clic derecho sobre el archivo > Copiar como ruta, y pegala acá).\nDejá vacío para volver a la búsqueda automática.", "");
  if (value === null) return;
  try {
    const response = await fetch("/api/excel-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: value }) });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error);
    await refreshExcelInfo();
    await importExcelData();
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("excel-upload")?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      setStatus(`Subiendo ${file.name}...`);
      const response = await fetch("/api/excel-upload", { method: "POST", body: file });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error);
      await refreshExcelInfo();
      await importExcelData();
      setStatus(`Excel guardado en ${payload.path} y sincronizado.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  input.click();
});

// ---------- Publicidades ----------
function adCurrentIndex(kind) {
  const item = state?.ads?.[kind];
  const list = state?.ads?.files?.[kind === "full" ? "full" : "zocalos"] || [];
  if (!item || !list.length) return -1;
  const total = list.length;
  if (!item.visible || item.mode === "fixed") return ((Number(item.index || 0) % total) + total) % total;
  const steps = Math.floor((Date.now() - Number(item.startedAt || 0)) / (Number(item.seconds || 8) * 1000));
  return (((Number(item.index || 0) + steps) % total) + total) % total;
}

let adsGridSignature = "";
function renderAds(force = false) {
  if (!state?.ads) return;
  const parts = [];
  for (const kind of ["full", "zocalo"]) {
    const list = state.ads.files?.[kind === "full" ? "full" : "zocalos"] || [];
    const item = state.ads[kind] || {};
    const current = adCurrentIndex(kind);
    parts.push(`${kind}:${list.map(a => a.src).join(",")}:${current}:${item.visible}`);
  }
  const signature = parts.join("|");
  if (!force && signature === adsGridSignature) return;
  adsGridSignature = signature;
  for (const kind of ["full", "zocalo"]) {
    const grid = document.getElementById(kind === "full" ? "ads-full-grid" : "ads-zocalo-grid");
    const status = document.getElementById(kind === "full" ? "ad-full-status" : "ad-zocalo-status");
    if (!grid) continue;
    const list = state.ads.files?.[kind === "full" ? "full" : "zocalos"] || [];
    const item = state.ads[kind] || {};
    const current = adCurrentIndex(kind);
    const prefix = kind === "full" ? "ad" : "zocalo";
    grid.innerHTML = list.length ? list.map((ad, index) => `
      <div class="ad-item" draggable="true" data-ad-index="${index}">
        <button type="button" class="ad-thumb ${index === current ? (item.visible ? "on-air" : "current") : ""}" data-ad-select="${prefix}-select-${index}" title="${escAttr(ad.file)}">
          <img src="${escAttr(ad.src)}" alt="" loading="lazy" draggable="false"><span>${index + 1}. ${escAttr(ad.label)}</span>
        </button>
        <div class="ad-order">
          <button type="button" data-ad-move="-1" title="Mover antes" ${index === 0 ? "disabled" : ""}>◀</button>
          <span title="Arrastrar para cambiar el orden">⠿</span>
          <button type="button" data-ad-move="1" title="Mover después" ${index === list.length - 1 ? "disabled" : ""}>▶</button>
        </div>
      </div>`).join("") : `<p class="hint">No hay imágenes${kind === "zocalo" ? " en la subcarpeta Zocalos" : " en la carpeta"}.</p>`;
    grid.querySelectorAll("[data-ad-select]").forEach(button => button.addEventListener("click", () => adAction(button.dataset.adSelect)));
    const listKey = kind === "full" ? "full" : "zocalos";
    const files = list.map(ad => ad.file);
    const move = (from, to) => {
      if (to < 0 || to >= files.length || from === to) return;
      const next = files.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      saveAdsOrder(listKey, next);
    };
    grid.querySelectorAll(".ad-item").forEach(el => {
      const index = Number(el.dataset.adIndex);
      el.querySelectorAll("[data-ad-move]").forEach(b => b.addEventListener("click", () => move(index, index + Number(b.dataset.adMove))));
      el.addEventListener("dragstart", event => { event.dataTransfer.setData("text/plain", `${listKey}:${index}`); el.classList.add("dragging"); });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      el.addEventListener("dragover", event => { event.preventDefault(); el.classList.add("drop-target"); });
      el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
      el.addEventListener("drop", event => {
        event.preventDefault();
        el.classList.remove("drop-target");
        const [fromKey, from] = String(event.dataTransfer.getData("text/plain")).split(":");
        if (fromKey === listKey) move(Number(from), index);
      });
    });
    if (status) {
      status.textContent = item.visible ? `● AL AIRE: ${list[current]?.label || ""}` : `(${list.length})`;
      status.classList.toggle("ad-on-air", Boolean(item.visible));
    }
  }
}

async function saveAdsOrder(kind, files) {
  try {
    clearTimeout(saveTimer);
    await save();
    const response = await fetch("/api/ads/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, files }) });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "No se pudo guardar el orden");
    applyRemoteState(payload.state, "Orden guardado");
    renderAds(true);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function adAction(action) {
  try {
    clearTimeout(saveTimer);
    await save();
    const response = await fetch(`/api/scorebug/${encodeURIComponent(action)}`, { method: "POST" });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || action);
    applyRemoteState(payload.state, "");
    renderAds(true);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadAds() {
  const data = await fetch("/api/ads", { cache: "no-store" }).then(r => r.json());
  const el = document.getElementById("ads-folder");
  if (el) el.innerHTML = `Carpeta <b class="${data.exists ? "ok" : "bad"}">${data.exists ? "✓" : "✗ no encontrada"}</b> <code>${escAttr(data.folder)}</code> <small>(${escAttr(data.source)}) · ${data.full.length} publicidades · ${data.zocalos.length} zócalos</small>`;
}

document.querySelectorAll("[data-ad-action]").forEach(button => button.addEventListener("click", () => adAction(button.dataset.adAction)));
document.getElementById("ads-reload")?.addEventListener("click", () => loadAds().then(() => setStatus("Carpeta de publicidades recargada.")).catch(error => setStatus(error.message, true)));
document.getElementById("ads-folder-change")?.addEventListener("click", async () => {
  const value = window.prompt("Ruta de la carpeta de publicidades (en el Explorador: clic derecho sobre la carpeta > Copiar como ruta). Dentro, la subcarpeta Zocalos.\nDejá vacío para la búsqueda automática.", "");
  if (value === null) return;
  try {
    const response = await fetch("/api/ads-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: value }) });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error);
    await loadAds();
  } catch (error) {
    setStatus(error.message, true);
  }
});
setInterval(() => renderAds(), 500);

document.getElementById("diamond-select")?.addEventListener("change", () => {
  // Al cambiar de diamante, el Upcoming se recarga solo con los partidos de ese diamante.
  if (!(state.excel?.fixture || []).length) return;
  setTimeout(() => loadUpcomingFromFixture().catch(error => setStatus(error.message, true)), 50);
});

document.getElementById("upcoming-from-fixture")?.addEventListener("click", () => loadUpcomingFromFixture().catch(error => setStatus(error.message, true)));

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
  await loadLogos().catch(() => {});
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
  .then(() => refreshExcelInfo().catch(() => {}))
  .then(() => loadAds().catch(() => {}))
  .then(() => loadLogos().catch(error => setStatus(error.message, true)))
  .then(connectStateEvents)
  .catch(error => setStatus(error.message, true));

const initialTab = new URLSearchParams(location.search).get("tab");
if (initialTab && document.querySelector(`[data-panel="${initialTab}"]`)) switchTab(initialTab);
