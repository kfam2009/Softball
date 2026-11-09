// Pestana DOMOS: control PTZ de camaras (adaptado de PanelGoLlegadas).
(() => {
  const root = document.getElementById("domos-root");
  if (!root) return;
  const $ = sel => root.querySelector(sel);
  const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const MARCA_LABEL = { foscam: "Foscam", longse: "Longse (ONVIF)" };
  let state = { lista: [], sel: 0, paso: 400, marcas: ["foscam", "longse"] };
  let msgTimer = null;

  root.innerHTML = `
    <section class="card wide">
      <h2>Domos (PTZ)</h2>
      <div class="dom-row">
        <label class="dom-grow">Cámara <select id="dom-sel"></select></label>
        <button type="button" class="btn secondary" id="dom-add">+ Cámara</button>
        <button type="button" class="btn danger" id="dom-del">Eliminar</button>
      </div>
      <div class="form-grid dom-form">
        <label>Nombre <input id="dom-nombre" autocomplete="off"></label>
        <label>Marca <select id="dom-marca"></select></label>
        <label>IP <input id="dom-host" placeholder="192.168.1.50 o IP de ZeroTier" autocomplete="off"></label>
        <label>Puerto <input id="dom-puerto" type="number" min="1" max="65535" placeholder="88"></label>
        <label>Usuario <input id="dom-usuario" autocomplete="off" placeholder="admin"></label>
        <label>Clave <input id="dom-clave" type="password" autocomplete="new-password"></label>
        <label>Input de vMix (para ver fluido) <input id="dom-vmix" placeholder="ej. 1, 3 o 4" autocomplete="off"></label>
      </div>
      <div class="dom-row">
        <button type="button" class="btn" id="dom-guardar">Guardar cámara</button>
        <button type="button" class="btn secondary" id="dom-probar">Probar</button>
        <button type="button" class="btn secondary" id="dom-ver">Ver cámara</button>
        <span class="dom-msg" id="dom-msg"></span>
      </div>
      <p class="dom-hint" id="dom-hint"></p>
    </section>
    <div class="grid dom-grid">
      <section class="card">
        <h2>Mover</h2>
        <div class="dom-ctrl">
          <div class="dompad">
            <button type="button" class="dbtn" data-dir="arriba-izq">↖</button><button type="button" class="dbtn" data-dir="arriba">↑</button><button type="button" class="dbtn" data-dir="arriba-der">↗</button>
            <button type="button" class="dbtn" data-dir="izq">←</button><button type="button" class="dbtn stop" id="dom-stop" title="Frenar">■</button><button type="button" class="dbtn" data-dir="der">→</button>
            <button type="button" class="dbtn" data-dir="abajo-izq">↙</button><button type="button" class="dbtn" data-dir="abajo">↓</button><button type="button" class="dbtn" data-dir="abajo-der">↘</button>
          </div>
          <div class="dom-row dom-center">
            <button type="button" class="dbtn zoom" data-zoom="mas">ZOOM +</button>
            <button type="button" class="dbtn zoom" data-zoom="menos">ZOOM −</button>
            <label>Paso
              <select id="dom-paso"><option value="200">Corto</option><option value="400">Medio</option><option value="800">Largo</option></select>
            </label>
          </div>
          <p class="dom-hint">Mantené apretada la flecha para mover y soltá para parar. Un toque corto mueve un paso (corto, medio o largo).</p>
        </div>
      </section>
      <section class="card">
        <h2>Vista</h2>
        <div class="domvista"><video id="dom-video" autoplay muted playsinline></video><img id="dom-img" alt=""><span id="dom-img-msg">Tocá "Ver cámara"</span></div>
        <p class="dom-hint" id="dom-vista-modo"></p>
      </section>
    </div>
    <section class="card wide">
      <h2>Medidor de WiFi <small class="dom-sub" id="wifi-cam"></small></h2>
      <div class="dom-row">
        <button type="button" class="btn" id="wifi-medir">Medir ahora</button>
        <label class="dom-check"><input type="checkbox" id="wifi-continuo"> Medir continuo (cada 15 s)</label>
        <span class="dom-msg" id="wifi-msg"></span>
      </div>
      <div class="wifi-grid">
        <div class="wifi-box">
          <div class="wifi-label">Señal que recibe la cámara</div>
          <div class="wifi-big" id="wifi-calidad">—</div>
          <div class="wifi-bar"><span id="wifi-bar"></span></div>
          <div class="wifi-sub" id="wifi-ssid">Red: —</div>
        </div>
        <div class="wifi-box">
          <div class="wifi-label">Respuesta al panel</div>
          <div class="wifi-big" id="wifi-ms">—</div>
          <div class="wifi-sub" id="wifi-ms-sub">Promedio de 5 pedidos</div>
        </div>
        <div class="wifi-box">
          <div class="wifi-label">Velocidad (foto de prueba)</div>
          <div class="wifi-big" id="wifi-mbps">—</div>
          <div class="wifi-sub" id="wifi-foto">—</div>
        </div>
      </div>
      <div class="wifi-hist" id="wifi-hist"></div>
      <details class="wifi-redes"><summary>Redes que ve la cámara</summary><div id="wifi-redes">—</div></details>
      <p class="dom-hint">La señal la mide la propia cámara (0 a 100): <b>70 o más buena</b>, <b>40 a 69 regular</b>, <b>menos de 40 mala</b>. Para ubicar la cámara o la antena, dejá "Medir continuo" y movela de a poco (se puede mirar desde el celular). Escanear redes puede cortar el video de la cámara 1 o 2 segundos: no lo dejes continuo en el aire.</p>
    </section>
    <section class="card wide">
      <h2>Posiciones guardadas</h2>
      <div class="preset-fila"><span class="preset-label">Ir a</span><span class="preset-row" id="dom-ir"></span></div>
      <div class="preset-fila"><span class="preset-label">Guardar acá</span><span class="preset-row guardar" id="dom-guardar-p"></span></div>
      <p class="dom-hint">Cada cámara tiene 6 posiciones. "Guardar acá" graba donde está apuntando ahora; "Ir a" la lleva a esa posición.</p>
    </section>`;

  function msg(text, isError = false) {
    const el = $("#dom-msg");
    el.textContent = text;
    el.classList.toggle("error", isError);
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.textContent = ""; }, isError ? 7000 : 3000);
  }

  async function post(path, body = {}) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!payload.ok) throw new Error(payload.error || "No respondió");
    return payload;
  }
  const cmd = (accion, body) => post(`/api/domo/${accion}`, { ...body, idx: state.sel }).catch(error => { msg(error.message, true); throw error; });

  const camara = () => state.lista[state.sel];

  function render() {
    const sel = $("#dom-sel");
    sel.innerHTML = state.lista.length
      ? state.lista.map((c, i) => `<option value="${i}" ${i === state.sel ? "selected" : ""}>${html(c.nombre || `Domo ${i + 1}`)}</option>`).join("")
      : `<option value="">Sin cámaras: tocá "+ Cámara"</option>`;
    $("#dom-marca").innerHTML = state.marcas.map(m => `<option value="${m}">${MARCA_LABEL[m] || m}</option>`).join("");
    const cam = camara() || {};
    $("#dom-nombre").value = cam.nombre || "";
    $("#dom-marca").value = cam.marca || "foscam";
    $("#dom-host").value = cam.host || "";
    $("#dom-puerto").value = cam.puerto || "";
    $("#dom-usuario").value = cam.usuario || "";
    $("#dom-clave").value = cam.clave || "";
    $("#dom-vmix").value = cam.vmixInput || "";
    $("#dom-paso").value = String(state.paso || 400);
    marcaHint();
  }

  function marcaHint() {
    const marca = $("#dom-marca").value;
    $("#dom-hint").innerHTML = marca === "longse"
      ? `<b>Longse (ONVIF): se activa cuando conectes la cámara.</b> Los comandos son distintos; los implementamos y probamos con la cámara conectada.`
      : `Foscam: puerto por defecto 88. El panel le manda los comandos a la IP de la cámara (red local o ZeroTier).`;
  }

  async function load() {
    const payload = await fetch("/api/domos", { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
    if (payload.domos) state = payload.domos;
    render();
  }

  async function saveAll(lista, sel, label) {
    const payload = await post("/api/domos", { lista, sel, paso: Number($("#dom-paso").value) || state.paso });
    state = payload.domos;
    render();
    if (label) msg(label);
  }

  function formCam() {
    const cam = camara() || {};
    return {
      ...cam,
      nombre: $("#dom-nombre").value.trim(),
      marca: $("#dom-marca").value,
      host: $("#dom-host").value.trim(),
      puerto: Number($("#dom-puerto").value) || 88,
      usuario: $("#dom-usuario").value.trim() || "admin",
      clave: $("#dom-clave").value,
      vmixInput: $("#dom-vmix").value.trim()
    };
  }

  $("#dom-sel").addEventListener("change", async event => {
    const keepExternal = viewMode === "external";
    if (!keepExternal) stopSnap();
    try {
      await saveAll(state.lista, Number(event.target.value) || 0);
      if (keepExternal) {
        if (camara()?.vmixInput) await setExternalInput(camara().vmixInput);
        else stopSnap();
      }
    } catch (error) { msg(error.message, true); }
  });
  $("#dom-marca").addEventListener("change", marcaHint);
  $("#dom-add").addEventListener("click", () => {
    const lista = state.lista.slice();
    lista.push({ nombre: `Domo ${lista.length + 1}`, marca: "foscam", host: "", puerto: 88, usuario: "admin", clave: "" });
    saveAll(lista, lista.length - 1, "Cámara agregada: completá los datos y Guardar").catch(error => msg(error.message, true));
  });
  $("#dom-del").addEventListener("click", () => {
    if (!state.lista.length) return;
    const cam = camara();
    if (!confirm(`¿Eliminar "${cam.nombre}"?`)) return;
    const lista = state.lista.filter((_, i) => i !== state.sel);
    stopSnap();
    saveAll(lista, Math.max(0, state.sel - 1), "Cámara eliminada").catch(error => msg(error.message, true));
  });
  $("#dom-guardar").addEventListener("click", () => {
    if (!state.lista.length) return msg('Primero tocá "+ Cámara"', true);
    const lista = state.lista.slice();
    lista[state.sel] = formCam();
    saveAll(lista, state.sel, "Cámara guardada").catch(error => msg(error.message, true));
  });
  $("#dom-probar").addEventListener("click", async () => {
    msg("Probando la cámara…");
    try {
      const r = await cmd("probar");
      msg(`Cámara OK: ${r.nombre || ""}`);
    } catch {}
  });
  $("#dom-paso").addEventListener("change", () => saveAll(state.lista, state.sel).catch(error => msg(error.message, true)));

  // Mantener apretado = mover; soltar = parar (un toque corto completa un "paso").
  function holdButton(button, start) {
    let downAt = 0;
    const ini = event => {
      event.preventDefault();
      if (!camara()) return msg('Primero agregá una cámara', true);
      button.setPointerCapture?.(event.pointerId);
      button.classList.add("act");
      downAt = Date.now();
      start().catch(() => {});
    };
    const fin = () => {
      if (!button.classList.contains("act")) return;
      button.classList.remove("act");
      cmd("parar", { heldMs: Date.now() - downAt }).catch(() => {});
    };
    button.addEventListener("pointerdown", ini);
    button.addEventListener("pointerup", fin);
    button.addEventListener("pointerleave", fin);
    button.addEventListener("pointercancel", fin);
    button.addEventListener("contextmenu", event => event.preventDefault());
  }
  root.querySelectorAll(".dbtn[data-dir]").forEach(b => holdButton(b, () => cmd("mover", { dir: b.dataset.dir })));
  root.querySelectorAll(".dbtn[data-zoom]").forEach(b => holdButton(b, () => cmd("zoom", { dir: b.dataset.zoom })));
  $("#dom-stop").addEventListener("click", () => cmd("parar", {}).then(() => msg("Frenada")).catch(() => {}));

  // Presets 1-6
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const ir = document.createElement("button");
    ir.type = "button"; ir.textContent = n;
    ir.addEventListener("click", () => cmd("preset", { accion: "ir", n }).then(() => msg(`Yendo a la posición ${n}`)).catch(() => {}));
    $("#dom-ir").appendChild(ir);
    const g = document.createElement("button");
    g.type = "button"; g.textContent = n;
    g.addEventListener("click", () => cmd("preset", { accion: "guardar", n }).then(() => msg(`Posición ${n} guardada`)).catch(() => {}));
    $("#dom-guardar-p").appendChild(g);
  }

  // Ver camara: primero intenta video MJPEG; si la camara no lo da, fotos seguidas (la siguiente apenas llega la anterior).
  // Todo pasa por el panel, asi la clave no viaja al navegador.
  const img = $("#dom-img");
  const video = $("#dom-video");
  let viewMode = "";        // "" | "external" | "mjpeg" | "fotos"
  let mediaStream = null;
  let viewing = 0;          // se incrementa al empezar/parar: corta los ciclos viejos
  let lastUrl = null;
  const setInfo = text => { $("#dom-img-msg").textContent = text; };
  function stopSnap() {
    viewing++;
    viewMode = "";
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    video.srcObject = null;
    video.classList.remove("on");
    img.onload = img.onerror = null;
    img.classList.remove("on");
    img.removeAttribute("src");
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    setInfo('Tocá "Ver cámara"');
    $("#dom-ver").textContent = "Ver cámara";
    $("#dom-vista-modo").textContent = "";
  }
  function startStream(token) {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 4000);
      img.onload = () => { clearTimeout(timer); resolve(token === viewing); };
      img.onerror = () => { clearTimeout(timer); resolve(false); };
      img.src = `/domo/stream?idx=${state.sel}&t=${Date.now()}`;
    });
  }
  async function snapLoop(token) {
    let frames = 0, since = Date.now(), errors = 0;
    while (token === viewing) {
      const t0 = Date.now();
      try {
        const response = await fetch(`/domo/snap?idx=${state.sel}&t=${t0}`, { cache: "no-store" });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No llega imagen");
        const blob = await response.blob();
        if (token !== viewing) break;
        const objectUrl = URL.createObjectURL(blob);
        await new Promise(resolve => { img.onload = img.onerror = resolve; img.src = objectUrl; });
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = objectUrl;
        img.classList.add("on"); setInfo(""); errors = 0;
        frames++;
        if (Date.now() - since > 2000) {
          $("#dom-vista-modo").textContent = `Fotos seguidas · ${(frames * 1000 / (Date.now() - since)).toFixed(1)} por segundo`;
          frames = 0; since = Date.now();
        }
      } catch (error) {
        errors++;
        if (!img.classList.contains("on")) setInfo(error.message);
        await new Promise(resolve => setTimeout(resolve, Math.min(3000, 500 * errors)));
      }
      const wait = 100 - (Date.now() - t0);   // como mucho ~10 por segundo
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
  // ---- Vista fluida por la salida External 2 de vMix ----
  // El panel pone la External 2 de vMix en el input de la camara y muestra la webcam virtual "vMix Video External 2".
  async function vmixCalls(calls) {
    const response = await fetch("/api/vmix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calls }) });
    const payload = await response.json().catch(() => ({}));
    if (!payload.ok) throw new Error(payload.error || "vMix no respondió (Settings → Web Controller)");
  }
  async function setExternalInput(input) {
    await vmixCalls([{ Function: "SetOutputExternal2", Value: "Input", Input: String(input) }]);
    $("#dom-vista-modo").textContent = `Video por vMix External 2 · input ${input}`;
  }
  async function vmixCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no deja ver cámaras (usá Chrome o Edge en esta PC)");
    let devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some(d => d.kind === "videoinput" && d.label)) {
      // Primero hay que pedir permiso para ver los nombres de las camaras.
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach(t => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
    }
    const cams = devices.filter(d => d.kind === "videoinput");
    const dev = cams.find(d => /vmix.*external\s*2/i.test(d.label)) || cams.find(d => /vmix/i.test(d.label));
    if (!dev) throw new Error(`No aparece la cámara virtual de vMix en esta PC (hay: ${cams.map(d => d.label).join(", ") || "ninguna"})`);
    return dev;
  }
  async function startExternal(token) {
    const cam = camara();
    const ping = await fetch("/api/vmix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ping: true }) }).then(r => r.json()).catch(() => ({}));
    if (!ping.ok) throw new Error("vMix no responde (Settings → Web Controller activado)");
    await setExternalInput(cam.vmixInput);
    if (!ping.external) await vmixCalls([{ Function: "StartExternal" }]);
    const dev = await vmixCamera();
    if (token !== viewing) return;
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: dev.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
    if (token !== viewing) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; return; }
    video.srcObject = mediaStream;
    video.classList.add("on");
    viewMode = "external";
    setInfo("");
    $("#dom-vista-modo").textContent = `Video por vMix External 2 · input ${cam.vmixInput} · ${dev.label}`;
  }

  $("#dom-ver").addEventListener("click", async () => {
    if ($("#dom-ver").textContent !== "Ver cámara") return stopSnap();
    if (!camara()) return msg("Primero agregá una cámara", true);
    const token = ++viewing;
    $("#dom-ver").textContent = "Dejar de ver";
    setInfo("Conectando…");
    if (camara().vmixInput) {
      try {
        return await startExternal(token);
      } catch (error) {
        if (token !== viewing) return;
        msg(`${error.message}. Uso la vista por fotos.`, true);
      }
    }
    if (await startStream(token)) {
      img.classList.add("on"); setInfo("");
      viewMode = "mjpeg";
      $("#dom-vista-modo").textContent = "Video en vivo (MJPEG)";
      img.onerror = () => { if (token === viewing) { img.classList.remove("on"); setInfo("Se cortó el video: tocá Ver cámara de nuevo"); } };
      return;
    }
    if (token !== viewing) return;
    img.onload = img.onerror = null;
    img.removeAttribute("src");
    viewMode = "fotos";
    snapLoop(token);
  });

  // ---------- Medidor de WiFi ----------
  let wifiBusy = false;
  let wifiTimer = null;
  const historial = [];
  const nivel = q => q === null || q === undefined ? "" : q >= 70 ? "buena" : q >= 40 ? "regular" : "mala";
  const nivelMs = ms => ms === null ? "mala" : ms < 80 ? "buena" : ms < 250 ? "regular" : "mala";
  function wifiMsg(text, isError = false) { const el = $("#wifi-msg"); el.textContent = text; el.classList.toggle("error", isError); }
  async function medirWifi() {
    if (wifiBusy) return;
    if (!camara()) return wifiMsg("Primero agregá una cámara", true);
    wifiBusy = true;
    $("#wifi-medir").disabled = true;
    const nombre = camara().nombre;
    $("#wifi-cam").textContent = `· ${nombre}`;
    wifiMsg("Midiendo… (unos 6 segundos)");
    const [wifi, red] = await Promise.allSettled([post("/api/domo/wifi", { idx: state.sel }), post("/api/domo/red", { idx: state.sel })]);
    const errores = [];
    let q = null;
    if (wifi.status === "fulfilled") {
      const w = wifi.value;
      q = w.calidad;
      $("#wifi-calidad").textContent = q === null ? (w.usaWifi ? "?" : "Cable") : `${q}`;
      $("#wifi-calidad").className = `wifi-big ${nivel(q)}`;
      $("#wifi-bar").style.width = `${q ?? 0}%`;
      $("#wifi-bar").className = nivel(q);
      $("#wifi-ssid").textContent = !w.usaWifi ? "La cámara está por cable (no usa WiFi)"
        : q === null ? `Red: ${w.ssid || "—"} (no apareció en el escaneo)` : `Red: ${w.ssid} · ${nivel(q)}`;
      $("#wifi-redes").innerHTML = w.redes.length
        ? w.redes.map(r => `<div class="wifi-red ${r.ssid === w.ssid ? "propia" : ""}"><span>${html(r.ssid || "(oculta)")}</span><b class="${nivel(r.calidad)}">${r.calidad}</b></div>`).join("")
        : "No vio ninguna red";
    } else errores.push(`WiFi: ${wifi.reason.message}`);
    let ms = null;
    if (red.status === "fulfilled") {
      const r = red.value;
      ms = r.respuestaMs;
      $("#wifi-ms").textContent = ms === null ? "Sin respuesta" : `${ms} ms`;
      $("#wifi-ms").className = `wifi-big ${nivelMs(ms)}`;
      $("#wifi-ms-sub").textContent = ms === null ? "No respondió" : `Máximo ${r.respuestaMax} ms · ${r.errores ? `${r.errores} de ${r.pedidos} fallaron` : "sin cortes"}`;
      $("#wifi-mbps").textContent = r.foto ? `${r.foto.mbps} Mbps` : "—";
      $("#wifi-mbps").className = `wifi-big ${r.foto ? (r.foto.mbps >= 4 ? "buena" : r.foto.mbps >= 1.5 ? "regular" : "mala") : "mala"}`;
      $("#wifi-foto").textContent = r.foto ? `Aprox.: foto de ${r.foto.kb} KB en ${r.foto.ms} ms` : "No llegó la foto";
    } else errores.push(`Red: ${red.reason.message}`);
    const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    historial.unshift({ hora, nombre, q, ms });
    historial.length = Math.min(historial.length, 12);
    $("#wifi-hist").innerHTML = historial.map(h => `<span class="wifi-chip ${nivel(h.q) || nivelMs(h.ms)}" title="${html(h.nombre)}">${h.hora} · ${h.q ?? "?"} · ${h.ms ?? "—"} ms</span>`).join("");
    wifiMsg(errores.length ? errores.join(" · ") : `Medido ${hora}`, errores.length > 0);
    $("#wifi-medir").disabled = false;
    wifiBusy = false;
  }
  $("#wifi-medir").addEventListener("click", medirWifi);
  $("#wifi-continuo").addEventListener("change", event => {
    clearInterval(wifiTimer); wifiTimer = null;
    if (event.target.checked) { medirWifi(); wifiTimer = setInterval(medirWifi, 15000); }
  });

  load();
})();
