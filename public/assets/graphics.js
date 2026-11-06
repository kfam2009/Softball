const stage = document.getElementById("stage");
const previewGraphic = new URLSearchParams(location.search).get("preview");
const assetVersion = "20261105-softball";
let fingerprint = "";
let lastGraphic = null;
let currentMarkup = "";
let hideTimer = null;
const layerNodes = new Map();

const vmixPlacement = {
  scorebug: { panX: 1.225434, panY: -1.25964, zoom: 0.738 },
  scoreboard: { panX: -0.00289017, panY: -1.161954, zoom: 1 },
  matchup: { panX: 0, panY: 0, zoom: 1 },
  rosterHome: { panX: 0, panY: 0, zoom: 1 },
  rosterAway: { panX: 0, panY: 0, zoom: 1 },
  umpires: { panX: -0.6098266, panY: -0.6323907, zoom: 0.7165 },
  player: { panX: -0.5780346, panY: -0.1388174, zoom: 1 },
  commentators: { panX: -0.6329479, panY: -0.3650386, zoom: 0.60825 },
  upcoming: { panX: 0, panY: 0, zoom: 1 },
  lineupHome: { panX: 0, panY: 0, zoom: 1 },
  lineupAway: { panX: 0, panY: 0, zoom: 1 },
  defense: { panX: 0, panY: 0, zoom: 1 }
};

function vmixStyle(key) {
  const placement = vmixPlacement[key] || {};
  const zoom = Number(placement.zoom || 1);
  const x = Number(placement.panX || 0) * 960 + (1 - zoom) * 960;
  const y = -Number(placement.panY || 0) * 540 + (1 - zoom) * 540;
  return `transform:translate(${x}px, ${y}px) scale(${zoom});`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function setTheme(theme) {
  for (const [key, value] of Object.entries(theme || {})) {
    document.documentElement.style.setProperty(`--${key}`, value);
  }
}

function gameIdText(match) {
  return String(match.gameId || "").trim();
}

function scaleStage() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = `scale(${scale})`;
}

function entryClass(key) {
  void key;
  return "";
}

function assetSrc(src) {
  const value = String(src || "").trim();
  if (!value) return "";
  return `${value}${value.includes("?") ? "&" : "?"}v=${assetVersion}`;
}

function teamMark(team, className = "team-logo") {
  if (team.logo) {
    return `<span class="${className}"><img src="${esc(assetSrc(team.logo))}" alt=""></span>`;
  }
  return `<span class="${className} team-logo-empty">${esc(team.short || "")}</span>`;
}

function matchupLogo(team) {
  if (!team.logo) return "";
  return `<div class="matchup-logo"><img src="${esc(assetSrc(team.logo))}" alt=""></div>`;
}

function rosterLogo(team) {
  if (team.logo) return `<span class="roster-team-logo"><img src="${esc(assetSrc(team.logo))}" alt=""></span>`;
  return `<span class="roster-team-logo roster-team-logo-empty">${esc(team.short || "")}</span>`;
}

function teamRow(team, side) {
  return `
    <div class="team ${side}">${teamMark(team)}${esc(team.short)}</div>
    <div class="score ${side}">${esc(team.score)}</div>
  `;
}

function dots(count, total, className) {
  return Array.from({ length: total }, (_, index) => `<span class="${className} ${count > index ? "on" : ""}"></span>`).join("");
}

function renderScorebug(state) {
  const match = state.match;
  const gameId = gameIdText(match);
  const bases = match.bases || {};
  const balls = Number(match.balls || 0);
  const strikes = Number(match.strikes || 0);
  const outs = Number(match.outs || 0);
  return `
    <section class="scorebug softball ${entryClass("scorebug")}">
      <div class="score-grid">
        ${teamRow(match.teams.away, "away")}
        <div class="inning-box">
          <i class="half-triangle ${match.half === "TOP" ? "top" : "bottom"}"></i>
          <strong>${esc(match.inning)}</strong>
        </div>
        ${teamRow(match.teams.home, "home")}
      </div>
      <div class="footer">
        <span class="count-indicator">
          <span class="count-text">${esc(balls)}-${esc(strikes)}</span>
          ${gameId ? `<span class="game-id">${esc(gameId)}</span>` : ""}
        </span>
        <span class="game-indicators">
          <span class="bases">
            <span class="base first ${bases.first ? "on" : ""}"></span>
            <span class="base second ${bases.second ? "on" : ""}"></span>
            <span class="base third ${bases.third ? "on" : ""}"></span>
          </span>
          <span class="outs"><span class="outs-label">OUT</span>${dots(outs, 2, "out")}</span>
        </span>
      </div>
    </section>
    <section class="live"><span class="live-dot"></span>${esc(state.event.status)}</section>
  `;
}

function innings(match) {
  const awayLine = match.teams.away.line || [];
  const homeLine = match.teams.home.line || [];
  const max = Math.max(awayLine.length, homeLine.length, Number(match.inning || 1), Number(match.regulationInnings || 7));
  return Array.from({ length: max }, (_, index) => index + 1);
}

function scoreboardCell(line, index, match, side) {
  const inning = index + 1;
  const currentInning = Number(match.inning || 1);
  if (inning > currentInning) return "";
  // El local todavia no bateo en la parte alta de la entrada actual.
  if (side === "home" && inning === currentInning && match.half === "TOP") return "";
  return esc(line[index] ?? 0);
}

function scoreboardRow(team, side, inningList, match) {
  const line = team.line || [];
  return `
    <tr>
      <td class="sb-team">${teamMark(team, "sb-team-logo")}${esc(team.short)}</td>
      ${inningList.map((_, index) => `<td>${scoreboardCell(line, index, match, side)}</td>`).join("")}
      <td class="sb-total">${esc(team.score)}</td>
      <td class="sb-he">${esc(team.hits ?? 0)}</td>
      <td class="sb-he">${esc(team.errors ?? 0)}</td>
    </tr>
  `;
}

function renderScoreboard(state) {
  const match = state.match;
  const gameId = gameIdText(match);
  const inningList = innings(match);
  return `
    <section class="scoreboard-card softball innings-${inningList.length} ${entryClass("scoreboard")}">
      <header class="scoreboard-header">
        <div>
          <div class="scoreboard-kicker">${esc(state.scoreboard?.subtitle || state.event.name)}</div>
          <div class="scoreboard-title">${esc(state.scoreboard?.title || "LINE SCORE")}</div>
        </div>
        <div class="scoreboard-meta">
          <span>${esc(state.event.status || "LIVE")}</span>
          <b><i class="half-triangle ${match.half === "TOP" ? "top" : "bottom"}"></i>${esc(match.inning)}${gameId ? ` | ${esc(gameId)}` : ""}</b>
        </div>
      </header>
      <table class="scoreboard-table">
        <thead>
          <tr><th>TEAM</th>${inningList.map(i => `<th>${esc(i)}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr>
        </thead>
        <tbody>${scoreboardRow(match.teams.away, "away", inningList, match)}${scoreboardRow(match.teams.home, "home", inningList, match)}</tbody>
      </table>
      <footer class="scoreboard-footer"></footer>
    </section>
  `;
}

function matchupTeam(team, side) {
  return `
    <article class="matchup-team ${side}">
      <div class="matchup-color" style="background:${esc(team.color)}"></div>
      ${matchupLogo(team)}
      <div class="matchup-short">${esc(team.short)}</div>
      <div class="matchup-name">${esc(team.name)}</div>
    </article>
  `;
}

function renderMatchup(state) {
  const matchup = state.matchup || {};
  const titleScale = Math.max(.75, Math.min(1.2, Number(matchup.titleScale || 1)));
  return `
    <section class="matchup-card ${entryClass("matchup")}">
      <div class="matchup-ribbon" style="--matchup-title-scale:${titleScale}">
        <span>${esc(matchup.subtitle || state.event.name)}</span>
        <strong>${esc(matchup.title || "MATCHUP")}</strong>
      </div>
      <div class="matchup-main">
        ${matchupTeam(state.match.teams.away, "away")}
        <div class="matchup-vs"><span>VS</span><b>${esc(matchup.round || "Group Stage")}</b></div>
        ${matchupTeam(state.match.teams.home, "home")}
      </div>
      <footer class="matchup-footer"><span>${esc(matchup.venue || "")}</span><span>${esc(state.event.status || "")}</span></footer>
    </section>
  `;
}

function parseRows(text) {
  return String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s{2,}/).filter(Boolean);
    const hasNumber = value => /^\d+$|^HC$/i.test(String(value || "").trim());
    if (parts.length >= 3) return { number: parts[0], name: parts[1], role: parts.slice(2).join(" ") };
    if (parts.length === 2 && !hasNumber(parts[0])) return { number: "", name: parts[0], role: parts[1] };
    if (parts.length === 2) return { number: parts[0], name: parts[1], role: "" };
    const loose = line.split(/\s+/);
    const first = loose[0] || "";
    if (hasNumber(first)) {
      const number = loose.shift() || "";
      return { number, role: loose.length > 2 ? loose.pop() : "", name: loose.join(" ") };
    }
    const role = loose.length > 1 ? loose.pop() : "";
    return { number: "", role, name: loose.join(" ") };
  });
}

function renderRosterRows(rows) {
  return rows.slice(0, 16).map(row => `
    <div class="roster-row"><span class="roster-number">${esc(row.number)}</span><span class="roster-name">${esc(row.name)}</span><span class="roster-role">${esc(row.role)}</span></div>
  `).join("");
}

function renderRoster(state, side) {
  const key = side === "home" ? "rosterHome" : "rosterAway";
  const team = state.match.teams[side];
  const excelRows = Array.isArray(state.excel?.[side]) ? state.excel[side] : [];
  const rows = excelRows.length ? excelRows : parseRows(state.rosters?.[side]?.playersText);
  return `
    <section class="roster-card ${side} ${rows.length > 12 ? "compact" : ""} ${entryClass(key)}">
      <header class="roster-header">
        <div><div class="roster-kicker">${esc(state.rosters?.subtitle || state.event.name)}</div><div class="roster-title">${esc(state.rosters?.title || "TEAM ROSTER")}</div></div>
        <div class="roster-side">${side === "home" ? "HOME" : "AWAY"}</div>
      </header>
      <div class="roster-team-band" style="--team-color:${esc(team.color)}">${rosterLogo(team)}<strong>${esc(team.name)}</strong></div>
      <div class="roster-table"><div class="roster-table-head"><span>#</span><span>Name</span><span>Pos</span></div>${renderRosterRows(rows)}</div>
      <footer class="roster-footer"><span>${esc(state.event.status || "")}</span><span>${esc(state.match.gameId || "SOFTBALL")}</span></footer>
    </section>
  `;
}

function parseCrew(text) {
  return String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s{2,}/).filter(Boolean);
    if (parts.length >= 3) return { code: parts[0], name: parts[1], role: parts.slice(2).join(" ") };
    const loose = line.split(/\s+/);
    return { code: loose.shift() || "", role: loose.length > 2 ? loose.slice(-2).join(" ") : "Official", name: loose.length > 2 ? loose.slice(0, -2).join(" ") : loose.join(" ") };
  });
}

function renderUmpires(state) {
  const umpires = state.umpires || {};
  const rows = parseCrew(umpires.crewText).slice(0, 8).map(row => `
    <div class="umpire-row"><span class="umpire-code">${esc(row.code)}</span><span class="umpire-name">${esc(row.name)}</span><span class="umpire-role">${esc(row.role)}</span></div>
  `).join("");
  return `
    <section class="umpires-card ${entryClass("umpires")}">
      <header class="umpires-topbar"><span>${esc(umpires.subtitle || state.event.name)}</span><strong>${esc(umpires.title || "OFFICIALS")}</strong></header>
      <div class="umpires-panel"><div class="umpires-heading">Game Crew</div><div class="umpires-list">${rows}</div><div class="umpires-footer"><span>${esc(state.event.status || "")}</span><span>${esc(state.match.gameId || "SOFTBALL")}</span></div></div>
    </section>
  `;
}

function renderPlayer(state) {
  const player = state.player || {};
  const side = player.teamSide === "away" ? "away" : "home";
  const team = state.match.teams[side];
  return `
    <section class="player-card ${entryClass("player")}" style="--team-color:${esc(team.color)}">
      <div class="player-id"><div class="player-team">${esc(team.name)}</div><div class="player-main"><div class="player-number">${esc(player.number)}</div><div><div class="player-name">${esc(player.name || "Player Name")}</div><div class="player-detail">${esc(player.detail || team.short)}</div></div></div><div class="player-strip"></div></div>
    </section>
  `;
}

function renderPerson(name, role, index) {
  return `<div class="commentator-person commentator-person-${index}"><span>${esc(role || "Commentator")}</span><strong>${esc(name || `Commentator ${index}`)}</strong></div>`;
}

function renderCommentators(state) {
  const data = state.commentators || {};
  const people = [renderPerson(data.name1, data.role1, 1)];
  if (data.layout === "two") people.push(renderPerson(data.name2, data.role2, 2));
  return `
    <section class="commentators-card ${data.layout === "two" ? "two-up" : "one-up"} ${entryClass("commentators")}">
      <div class="commentators-head"><span>${esc(data.subtitle || state.event?.name || "")}</span><strong>${esc(data.title || "COMMENTATORS")}</strong></div>
      <div class="commentators-body">${people.join("")}</div>
      <div class="commentators-strip"></div>
    </section>
  `;
}

function renderGame(game, index) {
  return `
    <article class="upcoming-game"><div class="upcoming-index">${index + 1}</div><div class="upcoming-teams"><strong>${esc(game.away || "Away")}</strong><span>vs</span><strong>${esc(game.home || "Home")}</strong></div><div class="upcoming-info"><span>${esc(game.time || "TBD")}</span><span>${esc(game.court || "")}</span></div><div class="upcoming-note"><span>${esc(game.round || "")}</span><b>${esc(game.status || "")}</b></div></article>
  `;
}

function renderUpcoming(state) {
  const data = state.upcoming || {};
  const count = Math.max(1, Math.min(3, Number(data.count || 3)));
  const games = (data.games || []).slice(0, count);
  while (games.length < count) games.push({});
  return `
    <section class="upcoming-card count-${count} ${entryClass("upcoming")}">
      <header class="upcoming-header"><span>${esc(data.subtitle || state.event?.name || "")}</span><strong>${esc(data.title || "UPCOMING GAMES")}</strong></header>
      <div class="upcoming-list">${games.map(renderGame).join("")}</div>
      <footer class="upcoming-footer"></footer>
    </section>
  `;
}


// ---------- Line up y defensa ----------
const fieldPositions = {
  P: { x: 500, y: 535, label: "P" },
  C: { x: 500, y: 655, label: "C" },
  "1B": { x: 760, y: 470, label: "1B" },
  "2B": { x: 650, y: 335, label: "2B" },
  SS: { x: 350, y: 335, label: "SS" },
  "3B": { x: 240, y: 470, label: "3B" },
  LF: { x: 205, y: 205, label: "LF" },
  CF: { x: 500, y: 115, label: "CF" },
  RF: { x: 795, y: 205, label: "RF" }
};
const positionAliases = { "1": "P", "2": "C", "3": "1B", "4": "2B", "5": "3B", "6": "SS", "7": "LF", "8": "CF", "9": "RF", LANZADOR: "P", PITCHER: "P", RECEPTOR: "C", CATCHER: "C" };

function normalizePos(value) {
  const key = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  return positionAliases[key] || key;
}

function parseLineup(text) {
  return String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    if (line.includes("|")) {
      const [order = "", number = "", name = "", pos = ""] = line.split("|").map(part => part.trim());
      return { order, number, name, pos };
    }
    let parts = line.split(/\s{2,}|\t/).map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) parts = line.split(/\s+/);
    if (parts.length >= 4) return { order: parts[0], number: parts[1], name: parts.slice(2, -1).join(" "), pos: parts[parts.length - 1] };
    if (parts.length === 3) return { order: parts[0], number: "", name: parts[1], pos: parts[2] };
    return { order: "", number: "", name: parts.join(" "), pos: "" };
  });
}

function lineupRows(state, side) {
  const excelKey = side === "home" ? "lineupHome" : "lineupAway";
  const excelRows = Array.isArray(state.excel?.[excelKey]) ? state.excel[excelKey] : [];
  const slots = Array.isArray(state.lineups?.[side]?.slots) ? state.lineups[side].slots : [];
  const slotRows = slots
    .map((slot, index) => ({ order: slot.flex ? "FLEX" : String(index + 1), number: slot.number, name: slot.name, pos: slot.pos }))
    .filter(row => String(row.name || "").trim());
  const textRows = parseLineup(state.lineups?.[side]?.text);
  const rows = (slotRows.length ? slotRows : textRows.length ? textRows : excelRows).filter(row => String(row.name || "").trim());
  // Si falta el orden al bate se numera solo; FLEX no batea.
  let next = 1;
  return rows.map(row => {
    const pos = normalizePos(row.pos);
    let order = String(row.order || "").trim();
    if (/^\d+$/.test(order)) next = Number(order) + 1;
    else if (!order) order = pos === "FLEX" ? "FLEX" : String(next++);
    return { ...row, order };
  });
}

function renderLineup(state, side) {
  const key = side === "home" ? "lineupHome" : "lineupAway";
  const team = state.match.teams[side];
  const data = state.lineups || {};
  const rows = lineupRows(state, side).slice(0, 12).map(row => {
    const order = String(row.order || "").trim();
    const isFlex = !/^\d+$/.test(order);
    return `
      <div class="lineup-row ${isFlex ? "flex-row" : ""}">
        <span class="lineup-order">${esc(order || "FLEX")}</span>
        <span class="lineup-number">${esc(row.number)}</span>
        <span class="lineup-name">${esc(row.name)}</span>
        <span class="lineup-pos">${esc(normalizePos(row.pos))}</span>
      </div>`;
  }).join("");
  return `
    <section class="roster-card lineup-card ${side} ${entryClass(key)}">
      <header class="roster-header">
        <div><div class="roster-kicker">${esc(data.subtitle || state.event.name)}</div><div class="roster-title">${esc(data.title || "LINEUP")}</div></div>
        <div class="roster-side">${side === "home" ? "HOME" : "AWAY"}</div>
      </header>
      <div class="roster-team-band" style="--team-color:${esc(team.color)}">${rosterLogo(team)}<strong>${esc(team.name)}</strong></div>
      <div class="lineup-table"><div class="lineup-head"><span>Bat</span><span>#</span><span>Name</span><span>Pos</span></div>${rows}</div>
      <footer class="roster-footer"><span>${esc(state.event.status || "")}</span><span>${esc(state.match.gameId || "SOFTBALL")}</span></footer>
    </section>
  `;
}

function defenseSide(state) {
  const choice = state.defense?.side || "auto";
  if (choice === "home" || choice === "away") return choice;
  return state.match.half === "BOTTOM" ? "away" : "home";
}

function renderDefense(state) {
  const side = defenseSide(state);
  const team = state.match.teams[side];
  const data = state.defense || {};
  const byPos = {};
  for (const row of lineupRows(state, side)) {
    const pos = normalizePos(row.pos);
    if (fieldPositions[pos] && !byPos[pos]) byPos[pos] = row;
  }
  const markers = Object.entries(fieldPositions).map(([pos, spot]) => {
    const row = byPos[pos];
    if (!row) return "";
    return `
      <div class="defense-player" style="left:${spot.x / 10}%;top:${spot.y / 7}%">
        <span class="defense-pos">${esc(spot.label)}</span>
        <span class="defense-number">${esc(row.number)}</span>
        <span class="defense-name">${esc(row.name)}</span>
      </div>`;
  }).join("");
  return `
    <section class="roster-card defense-card ${side} ${entryClass("defense")}">
      <header class="roster-header">
        <div><div class="roster-kicker">${esc(data.subtitle || state.event.name)}</div><div class="roster-title">${esc(data.title || "DEFENSE")}</div></div>
        <div class="roster-side defense-team" style="--team-color:${esc(team.color)}">${esc(team.short || team.name)}</div>
      </header>
      <div class="defense-field">
        <svg viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="grass" cx="50%" cy="100%" r="100%">
              <stop offset="0%" stop-color="#2f8f4e"/><stop offset="100%" stop-color="#1b5e33"/>
            </radialGradient>
          </defs>
          <path d="M500 680 L40 220 Q500 -120 960 220 Z" fill="url(#grass)" stroke="rgba(255,255,255,.55)" stroke-width="4"/>
          <path d="M500 680 L300 480 Q500 260 700 480 Z" fill="#b9814f" opacity=".92"/>
          <path d="M500 640 L640 500 L500 360 L360 500 Z" fill="#2f8f4e" stroke="#fff" stroke-width="4"/>
          <circle cx="500" cy="500" r="22" fill="#b9814f"/>
          <rect x="489" y="629" width="22" height="22" fill="#fff" transform="rotate(45 500 640)"/>
          <rect x="630" y="490" width="20" height="20" fill="#fff" transform="rotate(45 640 500)"/>
          <rect x="490" y="350" width="20" height="20" fill="#fff" transform="rotate(45 500 360)"/>
          <rect x="350" y="490" width="20" height="20" fill="#fff" transform="rotate(45 360 500)"/>
        </svg>
        ${markers}
      </div>
      <footer class="roster-footer"><span>${esc(team.name)}</span><span>${esc(state.match.gameId || "SOFTBALL")}</span></footer>
    </section>
  `;
}

const renderers = {
  scorebug: renderScorebug,
  scoreboard: renderScoreboard,
  matchup: renderMatchup,
  rosterAway: state => renderRoster(state, "away"),
  rosterHome: state => renderRoster(state, "home"),
  umpires: renderUmpires,
  player: renderPlayer,
  commentators: renderCommentators,
  upcoming: renderUpcoming,
  lineupAway: state => renderLineup(state, "away"),
  lineupHome: state => renderLineup(state, "home"),
  defense: renderDefense
};

function removeLayer(key, animated = true) {
  const node = layerNodes.get(key);
  if (!node) return;
  const transition = node.querySelector(".graphic-transition");
  transition?.classList.remove("graphic-transition-in");
  if (animated) {
    transition?.classList.add("graphic-transition-out");
    setTimeout(() => {
      if (layerNodes.get(key) === node) {
        node.remove();
        layerNodes.delete(key);
      }
    }, 460);
  } else {
    node.remove();
    layerNodes.delete(key);
  }
}

function upsertLayer(key, html, shouldAnimateIn) {
  let node = layerNodes.get(key);
  if (!node) {
    node = document.createElement("div");
    node.className = "graphic-layer";
    node.dataset.graphicLayer = key;
    node.setAttribute("style", vmixStyle(key));
    node.innerHTML = `<div class="graphic-transition ${shouldAnimateIn ? "graphic-transition-in" : ""}">${html}</div>`;
    stage.appendChild(node);
    layerNodes.set(key, node);
    return;
  }

  node.setAttribute("style", vmixStyle(key));
  const transition = node.querySelector(".graphic-transition");
  transition?.classList.remove("graphic-transition-out");
  if (transition && transition.innerHTML !== html) transition.innerHTML = html;
}

function renderLayerSet(layers) {
  const visibleKeys = new Set(layers.map(layer => layer.key));
  clearTimeout(hideTimer);

  for (const key of [...layerNodes.keys()]) {
    if (!visibleKeys.has(key)) removeLayer(key, true);
  }

  for (const layer of layers) {
    upsertLayer(layer.key, layer.html, !layerNodes.has(layer.key));
  }

  currentMarkup = layers.map(layer => `${layer.key}:${layer.html}`).join("");
  lastGraphic = layers.map(layer => layer.key).join("+");
}

function clearAllLayers(animated = true) {
  clearTimeout(hideTimer);
  if (!layerNodes.size) {
    lastGraphic = null;
    currentMarkup = "";
    stage.innerHTML = "";
    return;
  }
  for (const key of [...layerNodes.keys()]) removeLayer(key, animated);
  hideTimer = setTimeout(() => {
    if (!layerNodes.size) stage.innerHTML = "";
    lastGraphic = null;
    currentMarkup = "";
  }, animated ? 480 : 0);
}

function render(state) {
  const next = JSON.stringify(state);
  if (next === fingerprint) return;
  fingerprint = next;
  setTheme(state.theme);

  const isPreview = Boolean(previewGraphic);
  const activeGraphic = previewGraphic || state.ndi?.activeGraphic || "scorebug";
  const scorebugVisible = Boolean(state.ndi?.scorebugVisible);
  const playerVisible = Boolean(state.ndi?.playerVisible);
  const layeredMode = !isPreview && (
    activeGraphic === "scorebug" ||
    activeGraphic === "player" ||
    scorebugVisible ||
    playerVisible
  );
  const hasVisibleLayer = layeredMode ? (scorebugVisible || playerVisible) : Boolean(state.ndi?.visible);

  if (!isPreview && !hasVisibleLayer) {
    clearAllLayers(true);
    return;
  }

  const layers = [];
  if (layeredMode) {
    if (scorebugVisible) {
      layers.push({ key: "scorebug", html: renderScorebug(state) });
    }
    if (playerVisible) {
      layers.push({ key: "player", html: renderPlayer(state) });
    }
  } else {
    layers.push({ key: activeGraphic, html: (renderers[activeGraphic] || renderScorebug)(state) });
  }

  renderLayerSet(layers);
}

async function loadState() {
  const response = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" });
  render(await response.json());
}

function connectEvents() {
  const source = new EventSource("/events");
  source.onmessage = event => render(JSON.parse(event.data));
  source.onerror = () => {
    source.close();
    setTimeout(connectEvents, 1200);
  };
}

window.addEventListener("resize", scaleStage);
scaleStage();
loadState().then(connectEvents);
setInterval(() => loadState().catch(() => {}), 1000);
