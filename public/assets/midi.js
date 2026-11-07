// Panel GO Softball - controlador MIDI (Korg nanoKONTROL Studio u otro).
// Lee el MIDI desde el navegador (Chrome / Edge) y:
//  - maneja el panel (scorebug, conteo, publicidades) con /api/scorebug/<accion>
//  - maneja vMix (camaras con Cut directo, replay, jog) con /api/vmix
(() => {
  const root = document.getElementById("midi-root");
  if (!root) return;

  const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

  let config = {
    bindings: {},          // "cc:1:46" -> actionId
    cameras: ["1", "2", "3", "4", "5", "", "", ""],
    replayInput: "6",
    jogMode: "in",         // in (por defecto: corre el comienzo del replay seleccionado) | out | position
    jogDefaultV2: true,
    stinger: "1",          // transicion para entrar/salir: 1 o 2 (Stinger de vMix)
    returnDelay: 1200,     // ms despues del stinger para frenar el replay
    volumeInputs: ["1", "11"],   // faders de volumen: Volumen 1 (camara 1) y Volumen 2 (musica)
    jogStep: 1
  };
  let midiAccess = null;
  let learnTarget = null;   // actionId esperando un control
  let wizard = null;        // { list: [...], index }
  let lastMessage = "";
  let saveTimer = null;
  let jogPending = 0;
  let jogHistory = [];
  let liveState = null;
  let lastAssigned = { key: "", time: 0 };
  let lastCameraInput = "";   // ultima camara cortada desde el controlador
  let returnInput = "";       // camara que estaba al aire antes del replay

  // ---------- Acciones ----------
  const vmix = (Function, extra = {}) => ({ Function, ...extra });
  const replayInput = () => config.replayInput || undefined;

  const ACTIONS = [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `cam${i + 1}`, group: "Cámaras (Cut directo)", label: `Cámara ${i + 1} al aire`, hint: `Select ${i + 1}`,
      run: () => {
        const input = config.cameras[i];
        if (!input) throw new Error(`Cámara ${i + 1} sin input de vMix asignado (pestaña MIDI).`);
        lastCameraInput = input;
        return callVmix([vmix("CutDirect", { Input: input })], `Cámara ${i + 1} al aire (input ${input})`);
      }
    })),
    { id: "replay-markin", group: "Replay", label: "Mark In", hint: "Marker SET", run: () => callVmix([vmix("ReplayMarkIn", { Input: replayInput() })], "Replay: Mark In") },
    {
      id: "replay-markout", group: "Replay", label: "Mark Out (queda seleccionado)", hint: "Marker ◀",
      run: () => callVmix([
        vmix("ReplayMarkOut", { Input: replayInput() }),
        vmix("ReplaySelectLastEvent", { Input: replayInput(), Channel: "Current" })
      ], "Replay: Mark Out (seleccionado)")
    },
    ...[10, 15].map(seconds => ({
      id: `replay-last${seconds}`, group: "Replay", label: `Replay de los últimos ${seconds} s (queda seleccionado)`, hint: seconds === 10 ? "R 5" : "R 6",
      run: () => callVmix([
        vmix("ReplayMarkInOutLive", { Input: replayInput(), Value: seconds }),
        vmix("ReplaySelectLastEvent", { Input: replayInput(), Channel: "Current" })
      ], `Replay de ${seconds} s creado y seleccionado`)
    })),
    {
      // Igual que el Play del panel de replay de vMix: reproduce el evento seleccionado
      // y lo manda al aire con la transicion configurada en el replay de vMix (stinger).
      id: "replay-air", group: "Replay", label: "Play evento seleccionado al aire (con stinger de vMix)", hint: "Marker ▶",
      run: async () => {
        await rememberActive();
        await callVmix([
          vmix("ReplayPlaySelectedEventToOutput", { Input: replayInput(), Channel: "Current" })
        ], "Replay al aire (evento seleccionado)");
        applyFaderSpeed();   // la repe sale a la velocidad que marca el fader
      }
    },
    {
      // Vuelve a la camara que estaba antes del replay con el stinger y frena el replay.
      id: "replay-stop", group: "Replay", label: "Stop replay: volver a cámara con stinger", hint: "■ Stop",
      run: async () => {
        const target = returnInput || lastCameraInput || config.cameras.find(Boolean);
        if (!target) throw new Error("No sé a qué cámara volver: cortá una cámara primero.");
        await callVmix([vmix(`Stinger${config.stinger === "2" ? 2 : 1}`, { Input: target })], `Volviendo a input ${target} con stinger ${config.stinger}`);
        // La espera la hace el servidor (el navegador demora sus temporizadores en segundo plano).
        callVmix([vmix("ReplayStopEvents", { Input: replayInput(), _delay: Number(config.returnDelay || 1200) })], "Replay detenido").catch(error => flash(error.message, true));
        returnInput = "";
      }
    },
    { id: "replay-playpause", group: "Replay", label: "Play / Pausa replay", hint: "▶ Play", run: async () => { await callVmix([vmix("ReplayPlayPause", { Input: replayInput(), Channel: "Current" })], "Replay: Play/Pausa"); applyFaderSpeed(); } },
    { id: "replay-live", group: "Replay", label: "Replay a vivo (Live)", hint: "Cycle", run: () => callVmix([vmix("ReplayLive", { Input: replayInput() })], "Replay: Live") },
    { id: "replay-jog", group: "Replay", label: "Jog (corre el comienzo del replay seleccionado)", hint: "Rueda jog", kind: "relative" },
    {
      id: "replay-jogmode", group: "Replay", label: "Cambiar modo del jog (Punto In / Punto Out / Posición)", hint: "Track ▶",
      run: () => {
        const order = ["in", "out", "position"];
        config.jogMode = order[(order.indexOf(config.jogMode) + 1) % order.length];
        scheduleConfigSave();
        render();
        flash(`Jog: ${jogModeLabel()}`);
      }
    },
    { id: "replay-speed", group: "Replay", label: "Velocidad del replay (fader, cambia gradual)", hint: "Fader 8", kind: "absolute" },
    ...[0, 1].map(i => ({
      id: `volume-${i + 1}`, group: "Audio", hint: `Fader ${i + 1}`, kind: "volume", index: i,
      get label() { return `Volumen ${i + 1} (fader) → input ${config.volumeInputs?.[i] || "-"}${i === 0 ? " · cámara 1" : " · música"}`; }
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `replay-angle${i + 1}`, group: "Replay", label: `Ángulo de replay ${i + 1}`, hint: `R ${i + 1}`,
      run: () => callVmix([vmix(`ReplayACamera${i + 1}`, { Input: replayInput() })], `Replay: ángulo ${i + 1}`)
    })),
    ...[
      ["ball-plus", "Ball +", "S 1"], ["strike-plus", "Strike +", "S 2"], ["foul", "Foul", "S 3"], ["out-plus", "Out +", "S 4"],
      ["run-plus", "Carrera + (al que batea)", "M 1"], ["hit-plus", "Hit +", "M 2"], ["error-plus", "Error +", "M 3"], ["change-side", "Cambio de lado", "M 4"],
      ["base-first", "Base 1ra", "S 5"], ["base-second", "Base 2da", "S 6"], ["base-third", "Base 3ra", "S 7"], ["bases-clear", "Limpiar bases", "M 7"],
      ["count-reset", "Conteo 0-0", "S 8"], ["undo", "Deshacer", "M 8"]
    ].map(([id, label, hint]) => ({ id, group: "Juego", label, hint, run: () => panelAction(id, label) })),
    { id: "scorebug-toggle", group: "Gráficos", label: "Scorebug In/Out", hint: "● Rec", run: () => toggle("scorebug", liveState?.ndi?.scorebugVisible) },
    { id: "zocalo-toggle", group: "Gráficos", label: "Zócalo In/Out", hint: "◀◀", run: () => toggle("zocalo", liveState?.ads?.zocalo?.visible) },
    { id: "ad-toggle", group: "Gráficos", label: "Publicidad In/Out", hint: "▶▶", run: () => toggle("ad", liveState?.ads?.full?.visible) },
    { id: "zocalo-next", group: "Gráficos", label: "Zócalo siguiente", hint: "Track ◀", run: () => panelAction("zocalo-next", "Zócalo siguiente") },
    { id: "ad-next", group: "Gráficos", label: "Publicidad siguiente", hint: "", run: () => panelAction("ad-next", "Publicidad siguiente") }
  ];
  const byId = Object.fromEntries(ACTIONS.map(action => [action.id, action]));

  function jogModeLabel() {
    return { position: "Posición", in: "Punto In", out: "Punto Out" }[config.jogMode] || "Posición";
  }

  async function rememberActive() {
    try {
      const response = await fetch("/api/vmix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ping: true }) });
      const payload = await response.json();
      if (payload.ok && payload.active && payload.active !== String(config.replayInput)) returnInput = payload.active;
    } catch {}
  }

  async function callVmix(calls, label) {
    const response = await fetch("/api/vmix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calls }) });
    const payload = await response.json().catch(() => ({}));
    if (!payload.ok) throw new Error(payload.error || "vMix no respondió");
    flash(label);
  }

  async function panelAction(action, label) {
    const response = await fetch(`/api/scorebug/${action}`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!payload.ok) throw new Error(payload.error || action);
    liveState = payload.state;
    flash(label);
  }

  function toggle(kind, isOn) {
    return panelAction(`${kind}-${isOn ? "out" : "in"}`, `${kind} ${isOn ? "Out" : "In"}`);
  }

  // ---------- Jog y fader ----------
  function relativeDelta(value) {
    if (value === 64 || value === 0) return 0;
    if (value < 64) return value;            // horario: 1, 2, 3...
    if (value < 96) return -(value - 64);    // signo en bit 7: 65 = -1
    return value - 128;                      // complemento a 2: 127 = -1
  }

  function onJog(value) {
    const delta = relativeDelta(value);
    if (!delta) return;
    const now = Date.now();
    jogHistory = jogHistory.filter(t => now - t < 150);
    jogHistory.push(now);
    const accel = jogHistory.length > 8 ? 4 : jogHistory.length > 4 ? 2 : 1;   // girar rapido = saltos mas grandes
    jogPending += delta * accel * Number(config.jogStep || 1);
    if (!jogBusy) flushJog();
  }

  // Manda el jog acumulado; mientras vMix responde se siguen sumando cuadros (sin temporizadores).
  let jogBusy = false;
  async function flushJog() {
    jogBusy = true;
    while (jogPending) {
      const frames = jogPending;
      jogPending = 0;
      await sendJog(frames);
    }
    jogBusy = false;
  }

  async function sendJog(frames) {
    const fn = config.jogMode === "in" ? "ReplayMoveSelectedInPoint" : config.jogMode === "out" ? "ReplayMoveSelectedOutPoint" : "ReplayJumpFrames";
    const call = { Function: fn, Input: replayInput(), Value: frames };
    if (fn === "ReplayJumpFrames") call.Channel = "Current";
    try {
      await callVmix([call], `Jog ${jogModeLabel()}: ${frames > 0 ? "+" : ""}${frames} cuadros`);
    } catch (error) {
      flash(error.message, true);
    }
  }

  // Manda siempre el ultimo valor sin usar temporizadores del navegador
  // (Chrome los frena cuando la pestana queda tapada o en segundo plano).
  function latest(sendFn) {
    let busy = false, pending;
    const run = async () => {
      busy = true;
      while (pending !== undefined) {
        const value = pending;
        pending = undefined;
        try { await sendFn(value); } catch (error) { flash(error.message, true); }
      }
      busy = false;
    };
    return value => { pending = value; if (!busy) run(); };
  }

  // Velocidad del replay: el fader marca el objetivo y el servidor del panel hace la rampa gradual.
  let speedTarget = null;
  const absoluteKeys = new Set();  // controles que ya mandaron valores de fader (no de perilla)
  const SPEED_MIN = 0.05;
  const postSpeed = latest(async body => {
    const response = await fetch("/api/replay-speed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error("No se pudo cambiar la velocidad");
    flash(`Replay velocidad ${Math.round((body.target ?? speedTarget) * 100)}%`);
  });

  function setSpeedTarget(target) {
    speedTarget = Math.max(SPEED_MIN, Math.min(1, target));
    postSpeed({ target: speedTarget, input: replayInput() });
  }

  // vMix reproduce cada evento a su propia velocidad: al tirar una repe se vuelve a mandar la del fader.
  function applyFaderSpeed() {
    if (speedTarget === null) return;            // el fader todavia no se movio
    postSpeed({ target: speedTarget, input: replayInput(), now: true });
  }

  function onSpeed(msg) {
    if (msg.type === "pb") return setSpeedTarget(msg.value / 16383);      // fader en modo Mackie (14 bits)
    const delta = relativeDelta(msg.value);
    if (msg.type === "cc" && !(msg.value >= 1 && msg.value <= 15) && !(msg.value >= 65 && msg.value <= 79)) absoluteKeys.add(msg.key);
    if (msg.type === "cc" && msg.relativeHint && delta && !absoluteKeys.has(msg.key)) { // perilla: sube/baja de a poco
      return setSpeedTarget((speedTarget ?? 1) + delta * 0.02);
    }
    return setSpeedTarget(msg.value / 127);                               // fader comun (CC 0-127)
  }

  // Volumen: el fader manda SetVolume al input configurado (0-100), sin saturar vMix.
  const volumeState = [0, 1].map(index => ({
    level: null,
    sent: null,
    send: latest(async value => {
      const input = config.volumeInputs?.[index];
      if (!input || value === volumeState[index].sent) return;
      volumeState[index].sent = value;
      await callVmix([{ Function: "SetVolume", Input: input, Value: value }], `Volumen input ${input}: ${value}%`);
    })
  }));
  function onVolume(index, msg) {
    const st = volumeState[index];
    let level;
    if (msg.type === "pb") level = msg.value / 16383;
    else {
      const delta = relativeDelta(msg.value);
      if (msg.type === "cc" && !(msg.value >= 1 && msg.value <= 15) && !(msg.value >= 65 && msg.value <= 79)) absoluteKeys.add(msg.key);
      if (msg.type === "cc" && msg.relativeHint && delta && !absoluteKeys.has(msg.key)) level = (st.level ?? 1) + delta * 0.02;
      else level = msg.value / 127;
    }
    st.level = Math.max(0, Math.min(1, level));
    st.send(Math.round(st.level * 100));
  }

  // ---------- MIDI ----------
  function keyFor(data) {
    const status = data[0] & 0xf0;
    const channel = (data[0] & 0x0f) + 1;
    if (status === 0xb0) return { type: "cc", key: `cc:${channel}:${data[1]}`, value: data[2], isPress: data[2] > 0, relativeHint: (data[2] >= 1 && data[2] <= 15) || (data[2] >= 65 && data[2] <= 79), label: `CC ${data[1]} (canal ${channel})` };
    if (status === 0xe0) {
      // Fader en modo Mackie: pitch bend de 14 bits por canal.
      const value = (data[2] << 7) | data[1];
      return { type: "pb", key: `pb:${channel}`, value, isPress: false, label: `Fader ${channel} (pitch bend)` };
    }
    if (status === 0x90) return { key: `note:${channel}:${data[1]}`, value: data[2], isPress: data[2] > 0, label: `Nota ${data[1]} (canal ${channel})` };
    if (status === 0x80) return { key: `note:${channel}:${data[1]}`, value: 0, isPress: false, label: `Nota ${data[1]} off` };
    return null;
  }

  function onMidiMessage(event) {
    const msg = keyFor(event.data);
    if (!msg) return;
    lastMessage = `${msg.label} = ${msg.value}`;
    const monitor = root.querySelector("#midi-last");
    if (monitor) monitor.textContent = lastMessage;

    if (learnTarget) {
      // Ignora el "soltar" del control recien asignado (sino el siguiente paso lo tomaria).
      if (msg.key === lastAssigned.key && Date.now() - lastAssigned.time < 1500) return;
      if (!msg.isPress && !["absolute", "volume"].includes(byId[learnTarget]?.kind)) return;
      assign(learnTarget, msg.key);
      lastAssigned = { key: msg.key, time: Date.now() };
      if (wizard) {
        wizard.index += 1;
        learnTarget = wizard.list[wizard.index] || null;
        if (!learnTarget) {
          wizard = null;
          flash("Asistente terminado. ¡Listo para usar!");
        }
      } else {
        learnTarget = null;
      }
      render();
      return;
    }

    const actionId = config.bindings[msg.key];
    const action = byId[actionId];
    if (!action) return;
    if (action.kind === "relative") return onJog(msg.value);
    if (action.kind === "absolute") return onSpeed(msg);
    if (action.kind === "volume") return onVolume(action.index, msg);
    if (!msg.isPress) return;
    Promise.resolve().then(() => action.run()).catch(error => flash(error.message, true));
  }

  function assign(actionId, key) {
    for (const [k, v] of Object.entries(config.bindings)) {
      if (v === actionId || k === key) delete config.bindings[k];
    }
    config.bindings[key] = actionId;
    scheduleConfigSave();
  }

  function bindingOf(actionId) {
    const entry = Object.entries(config.bindings).find(([, v]) => v === actionId);
    if (!entry) return "";
    const [type, ch, num] = entry[0].split(":");
    if (type === "pb") return `Fader ${ch}`;
    return `${type === "cc" ? "CC" : "Nota"} ${num}${ch !== "1" ? ` · c${ch}` : ""}`;
  }

  function attachInputs() {
    if (!midiAccess) return;
    for (const input of midiAccess.inputs.values()) input.onmidimessage = onMidiMessage;
    render();
  }

  async function connectMidi() {
    if (!navigator.requestMIDIAccess) {
      flash("Este navegador no tiene MIDI. Abrí el panel en Chrome o Edge.", true);
      render();
      return;
    }
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      midiAccess.onstatechange = attachInputs;
      attachInputs();
    } catch (error) {
      flash(`Sin permiso de MIDI (${error.message}). Aceptá el permiso del navegador o abrí el panel en Chrome / Edge.`, true);
      render();
    }
  }

  // ---------- Config ----------
  async function loadConfig() {
    const data = await fetch("/api/midi", { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
    const saved = data.config || {};
    config = { ...config, ...saved };
    // Configs anteriores arrancaban el jog en "Posicion": ahora por defecto corre el Punto In.
    if (!saved.jogDefaultV2) {
      config.jogMode = "in";
      config.jogDefaultV2 = true;
    }
    config.bindings ||= {};
    while (config.cameras.length < 8) config.cameras.push("");
    if (!Array.isArray(config.volumeInputs)) config.volumeInputs = ["1", "11"];
  }

  function scheduleConfigSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch("/api/midi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) }).catch(() => {});
    }, 200);
  }

  // ---------- UI ----------
  let flashTimer = null;
  function flash(text, isError = false) {
    const el = root.querySelector("#midi-flash");
    if (!el) return;
    el.textContent = text;
    el.className = `midi-flash ${isError ? "error" : ""}`;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.textContent = ""; }, isError ? 6000 : 2500);
  }

  function devicesHtml() {
    if (!navigator.requestMIDIAccess) return `<b class="bad">Este navegador no soporta MIDI: abrí el panel en Chrome o Edge.</b>`;
    if (!midiAccess) return `<button type="button" class="btn" id="midi-connect">Conectar MIDI</button> <small>El navegador va a pedir permiso.</small>`;
    const inputs = [...midiAccess.inputs.values()];
    if (!inputs.length) return `<b class="bad">No hay controladores MIDI conectados.</b>`;
    return inputs.map(input => `<b class="ok">● ${html(input.name)}</b> <small>${html(input.manufacturer || "")}</small>`).join(" &nbsp; ");
  }

  function render() {
    const groups = [...new Set(ACTIONS.map(action => action.group))];
    root.innerHTML = `
      <section class="card wide">
        <h2>Controlador MIDI</h2>
        <div class="midi-status">${devicesHtml()}</div>
        <div class="midi-monitor">Último mensaje: <code id="midi-last">${html(lastMessage || "—")}</code> <span id="midi-flash" class="midi-flash"></span></div>
        <div class="vmix-actions" style="margin-top:10px">
          <button type="button" class="btn" id="midi-wizard">${wizard ? "Cancelar asistente" : "Asistente de configuración"}</button>
          <button type="button" class="btn secondary" id="midi-test-vmix">Probar conexión con vMix</button>
          <button type="button" class="btn danger" id="midi-clear">Borrar asignaciones</button>
        </div>
        ${learnTarget ? `<div class="midi-learn">👉 Tocá en el controlador el botón para: <b>${html(byId[learnTarget]?.label)}</b> <small>(sugerido: ${html(byId[learnTarget]?.hint || "-")})</small> ${wizard ? `<span>${wizard.index + 1} / ${wizard.list.length}</span> <button type="button" class="btn secondary logo-upload-btn" id="midi-skip">Saltear</button>` : `<button type="button" class="btn secondary logo-upload-btn" id="midi-cancel">Cancelar</button>`}</div>` : ""}
        <p class="hint">El panel tiene que estar abierto en <b>Chrome o Edge</b> en la PC donde está conectado el controlador. Para vMix: Settings → Web Controller activado.</p>
      </section>
      <div class="grid">
        <section class="card">
          <h2>vMix</h2>
          <div class="form-grid">
            ${config.cameras.map((value, i) => `<label>Cámara ${i + 1} → input <input data-midi-camera="${i}" value="${html(value)}" placeholder="-"></label>`).join("")}
            <label>Replay → input <input id="midi-replay-input" value="${html(config.replayInput)}"></label>
            ${[0, 1].map(i => `<label>Volumen ${i + 1} → input <input data-midi-volume="${i}" value="${html(config.volumeInputs[i])}" placeholder="-"></label>`).join("")}
            <label>Jog: cuadros por paso <input id="midi-jog-step" type="number" min="1" max="10" value="${html(config.jogStep)}"></label>
            <label>Stop replay: transición
              <select id="midi-stinger">
                <option value="1" ${config.stinger !== "2" ? "selected" : ""}>Stinger 1</option>
                <option value="2" ${config.stinger === "2" ? "selected" : ""}>Stinger 2</option>
              </select>
            </label>
          </div>
          <div class="midi-jog">Modo del jog: <b>${html(jogModeLabel())}</b>
            ${["in", "out", "position"].map(mode => `<button type="button" class="btn ${config.jogMode === mode ? "" : "secondary"} logo-upload-btn" data-jog-mode="${mode}">${{ position: "Posición", in: "Punto In", out: "Punto Out" }[mode]}</button>`).join("")}
          </div>
        </section>
        <section class="card">
          <h2>Asignaciones</h2>
          ${groups.map(group => `
            <h3 class="midi-group">${html(group)}</h3>
            <div class="midi-list">
              ${ACTIONS.filter(action => action.group === group).map(action => `
                <div class="midi-row ${learnTarget === action.id ? "learning" : ""}">
                  <span>${html(action.label)}</span>
                  <code>${html(bindingOf(action.id) || "—")}</code>
                  <button type="button" class="btn secondary logo-upload-btn" data-midi-learn="${action.id}">Aprender</button>
                  ${action.run ? `<button type="button" class="btn secondary logo-upload-btn" data-midi-run="${action.id}">Probar</button>` : "<span></span>"}
                </div>`).join("")}
            </div>`).join("")}
        </section>
      </div>`;

    root.querySelector("#midi-connect")?.addEventListener("click", connectMidi);
    root.querySelector("#midi-wizard")?.addEventListener("click", () => {
      if (wizard) {
        wizard = null;
        learnTarget = null;
      } else {
        wizard = { list: ACTIONS.map(action => action.id), index: 0 };
        learnTarget = wizard.list[0];
        if (!midiAccess) connectMidi();
      }
      render();
    });
    root.querySelector("#midi-skip")?.addEventListener("click", () => {
      wizard.index += 1;
      learnTarget = wizard.list[wizard.index] || null;
      if (!learnTarget) wizard = null;
      render();
    });
    root.querySelector("#midi-cancel")?.addEventListener("click", () => { learnTarget = null; render(); });
    root.querySelector("#midi-clear")?.addEventListener("click", () => {
      if (!window.confirm("Borrar todas las asignaciones del controlador?")) return;
      config.bindings = {};
      scheduleConfigSave();
      render();
    });
    root.querySelector("#midi-test-vmix")?.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/vmix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ping: true }) });
        const payload = await response.json();
        if (!payload.ok) throw new Error(payload.error || "vMix no respondió");
        flash(`vMix responde ✓ ${payload.version ? `(versión ${payload.version})` : ""}`);
      } catch (error) {
        flash(error.message, true);
      }
    });
    root.querySelectorAll("[data-midi-learn]").forEach(button => button.addEventListener("click", () => {
      wizard = null;
      learnTarget = button.dataset.midiLearn;
      if (!midiAccess) connectMidi();
      render();
    }));
    root.querySelectorAll("[data-midi-run]").forEach(button => button.addEventListener("click", () => {
      Promise.resolve().then(() => byId[button.dataset.midiRun].run()).catch(error => flash(error.message, true));
    }));
    root.querySelectorAll("[data-midi-camera]").forEach(input => input.addEventListener("change", () => {
      config.cameras[Number(input.dataset.midiCamera)] = input.value.trim();
      scheduleConfigSave();
    }));
    root.querySelectorAll("[data-midi-volume]").forEach(input => input.addEventListener("change", () => {
      config.volumeInputs[Number(input.dataset.midiVolume)] = input.value.trim();
      scheduleConfigSave();
      render();
    }));
    root.querySelector("#midi-replay-input")?.addEventListener("change", event => { config.replayInput = event.target.value.trim(); scheduleConfigSave(); });
    root.querySelector("#midi-stinger")?.addEventListener("change", event => { config.stinger = event.target.value; scheduleConfigSave(); });
    root.querySelector("#midi-jog-step")?.addEventListener("change", event => { config.jogStep = Math.max(1, Number(event.target.value) || 1); scheduleConfigSave(); });
    root.querySelectorAll("[data-jog-mode]").forEach(button => button.addEventListener("click", () => {
      config.jogMode = button.dataset.jogMode;
      scheduleConfigSave();
      render();
    }));
  }

  // Estado del panel (para los botones In/Out que alternan)
  function followState() {
    const source = new EventSource("/events");
    source.onmessage = event => {
      try { liveState = JSON.parse(event.data); } catch {}
    };
    source.onerror = () => { source.close(); setTimeout(followState, 2000); };
  }

  window.panelMidi = { onMidiMessage, actions: ACTIONS, getConfig: () => config };

  loadConfig().then(() => {
    render();
    followState();
    // Si el permiso ya fue dado antes, conecta solo.
    navigator.permissions?.query({ name: "midi" }).then(status => {
      if (status.state === "granted") connectMidi();
    }).catch(() => {});
  });
})();
