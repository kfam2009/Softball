// Pestana COLOR: igualar el color de las camaras con la Correccion de color (Gain R/G/B) de vMix.
(() => {
  const root = document.getElementById("color-root");
  if (!root) return;
  const $ = sel => root.querySelector(sel);
  const html = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(key, def) { try { const v = JSON.parse(localStorage.getItem(`cc-${key}`)); return v ?? def; } catch { return def; } },
    set(key, value) { try { localStorage.setItem(`cc-${key}`, JSON.stringify(value)); } catch {} }
  };

  let cams = [];                         // [{input, img, stats, region, gains}]
  let regions = store.get("regions", {}); // input -> {x,y,w,h} (0-1)
  let applied = store.get("applied", {}); // input -> {r,g,b}
  let baseStats = {};                     // medicion con Gain 1 (para verificar)

  root.innerHTML = `
    <section class="card wide">
      <h2>Igualar colores de las cámaras</h2>
      <p class="dom-hint">El panel le pide a vMix una foto de cada cámara, compara el color y ajusta la <b>Corrección de color (Gain rojo / verde / azul)</b> de cada input para que se parezcan a la cámara patrón. No toca Lift, Gamma ni Saturación.</p>
      <div class="form-grid cc-form">
        <label>Inputs de las cámaras <input id="cc-inputs" placeholder="1,2,3,4,5"></label>
        <label>Cámara patrón (input) <select id="cc-ref"></select></label>
        <label>Qué comparar
          <select id="cc-mode">
            <option value="zona">La zona marcada en cada foto (recomendado)</option>
            <option value="todo">Toda la imagen</option>
          </select>
        </label>
      </div>
      <div class="dom-row">
        <button type="button" class="btn secondary" id="cc-medir">1. Sacar fotos y medir</button>
        <button type="button" class="btn" id="cc-igualar">2. Igualar con la patrón</button>
        <button type="button" class="btn secondary" id="cc-verificar">Verificar</button>
        <button type="button" class="btn danger" id="cc-reset">Restablecer (Gain = 1)</button>
        <span class="dom-msg" id="cc-msg"></span>
      </div>
      <p class="dom-hint"><b>Cómo:</b> poné algo neutro que vean todas las cámaras (cartulina gris o blanca, una base, la línea de cal). Tocá <b>Sacar fotos</b> y en cada foto <b>arrastrá un rectángulo</b> sobre eso. Después <b>Igualar</b>. Conviene que las cámaras tengan el balance de blancos fijo (no automático). Repetilo si cambia la luz.</p>
    </section>
    <div class="cc-grid" id="cc-grid"></div>`;

  function msg(text, isError = false) { const el = $("#cc-msg"); el.textContent = text; el.classList.toggle("error", isError); }
  const inputsList = () => $("#cc-inputs").value.split(/[\s,;]+/).map(v => v.trim()).filter(v => /^\d+$/.test(v));

  async function vmixCalls(calls) {
    const response = await fetch("/api/vmix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calls }) });
    const payload = await response.json().catch(() => ({}));
    if (!payload.ok) throw new Error(payload.error || "vMix no respondió (Settings → Web Controller)");
  }
  const gainCalls = (input, g) => [
    { Function: "SetCCGainR", Input: input, Value: g.r.toFixed(3) },
    { Function: "SetCCGainG", Input: input, Value: g.g.toFixed(3) },
    { Function: "SetCCGainB", Input: input, Value: g.b.toFixed(3) }
  ];

  function fillRef() {
    const list = inputsList();
    const current = store.get("ref", list[0] || "");
    $("#cc-ref").innerHTML = list.map(i => `<option value="${i}" ${i === current ? "selected" : ""}>Input ${i}</option>`).join("");
  }

  // Promedio de color de la zona (o de toda la imagen), sin las partes quemadas o muy oscuras.
  function measure(img, region) {
    const W = 320, H = Math.round(320 * img.naturalHeight / img.naturalWidth) || 180;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const r0 = region && $("#cc-mode").value === "zona" ? region : { x: 0, y: 0, w: 1, h: 1 };
    const x0 = Math.floor(r0.x * W), y0 = Math.floor(r0.y * H);
    const w = Math.max(2, Math.floor(r0.w * W)), h = Math.max(2, Math.floor(r0.h * H));
    const data = ctx.getImageData(x0, y0, Math.min(w, W - x0), Math.min(h, H - y0)).data;
    let r = 0, g = 0, b = 0, n = 0, clipped = 0;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const max = Math.max(R, G, B), min = Math.min(R, G, B);
      if (max >= 250 || min <= 6) { clipped++; continue; }
      r += R; g += G; b += B; n++;
    }
    if (!n) return null;
    r /= n; g /= n; b /= n;
    return { r, g, b, y: 0.2126 * r + 0.7152 * g + 0.0722 * b, clipped: clipped / (n + clipped) };
  }

  function render() {
    const ref = $("#cc-ref").value;
    const refCam = cams.find(c => c.input === ref);
    $("#cc-grid").innerHTML = cams.map(c => {
      const s = c.stats;
      const isRef = c.input === ref;
      const g = applied[c.input];
      let diff = "";
      if (s && refCam?.stats && !isRef) {
        const d = ch => Math.round((s[ch] / refCam.stats[ch] - 1) * 100);
        diff = `<div class="cc-diff">vs patrón: R ${d("r") > 0 ? "+" : ""}${d("r")}% · G ${d("g") > 0 ? "+" : ""}${d("g")}% · B ${d("b") > 0 ? "+" : ""}${d("b")}%</div>`;
      }
      return `
        <div class="cc-cam ${isRef ? "ref" : ""}" data-input="${c.input}">
          <div class="cc-head"><b>Input ${c.input}</b>${isRef ? `<span class="cc-badge">PATRÓN</span>` : ""}</div>
          <div class="cc-pic">${c.url ? `<img src="${html(c.url)}" alt="" draggable="false">` : `<span>${html(c.error || "Sin foto")}</span>`}<div class="cc-box"></div></div>
          ${s ? `<div class="cc-swatch" style="background: rgb(${s.r | 0}, ${s.g | 0}, ${s.b | 0})"></div>
          <div class="cc-stats">R ${s.r.toFixed(0)} · G ${s.g.toFixed(0)} · B ${s.b.toFixed(0)} · Brillo ${s.y.toFixed(0)}${s.clipped > .25 ? ` · <span class="error">mucha zona quemada</span>` : ""}</div>${diff}` : ""}
          <div class="cc-gain">Gain aplicado: ${g ? `R ${g.r.toFixed(2)} · G ${g.g.toFixed(2)} · B ${g.b.toFixed(2)}` : "1 · 1 · 1"}</div>
        </div>`;
    }).join("");
    $("#cc-grid").querySelectorAll(".cc-cam").forEach(card => setupRegion(card));
  }

  // Arrastrar un rectangulo sobre la foto para marcar la zona neutra.
  function setupRegion(card) {
    const input = card.dataset.input;
    const pic = card.querySelector(".cc-pic");
    const box = card.querySelector(".cc-box");
    const show = r => {
      if (!r) { box.style.display = "none"; return; }
      Object.assign(box.style, { display: "block", left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
    };
    show(regions[input]);
    let start = null;
    const pos = e => { const b = pic.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
    pic.addEventListener("pointerdown", e => { if (!pic.querySelector("img")) return; e.preventDefault(); pic.setPointerCapture(e.pointerId); start = pos(e); });
    pic.addEventListener("pointermove", e => {
      if (!start) return;
      const p = pos(e);
      show({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
    });
    pic.addEventListener("pointerup", e => {
      if (!start) return;
      const p = pos(e);
      const r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      start = null;
      if (r.w < .02 || r.h < .02) delete regions[input]; else regions[input] = r;
      store.set("regions", regions);
      const cam = cams.find(c => c.input === input);
      if (cam?.img) cam.stats = measure(cam.img, regions[input]);
      render();
    });
  }

  async function snapAll() {
    const list = inputsList();
    if (!list.length) throw new Error("Poné los inputs de las cámaras (ej. 1,2,3,4,5)");
    const response = await fetch("/api/cc/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs: list }) });
    const payload = await response.json().catch(() => ({}));
    if (!payload.ok) throw new Error(payload.error || "No se pudieron sacar las fotos");
    cams = await Promise.all(payload.results.map(r => new Promise(resolve => {
      if (!r.url) return resolve({ input: r.input, error: r.error });
      const img = new Image();
      img.onload = () => resolve({ input: r.input, url: r.url, img, stats: measure(img, regions[r.input]) });
      img.onerror = () => resolve({ input: r.input, error: "No se pudo abrir la foto" });
      img.src = `${r.url}?t=${Date.now()}`;
    })));
    render();
    return cams;
  }

  async function run(button, label, fn) {
    root.querySelectorAll(".dom-row .btn").forEach(b => { b.disabled = true; });
    msg(label);
    try { await fn(); } catch (error) { msg(error.message, true); }
    finally { root.querySelectorAll(".dom-row .btn").forEach(b => { b.disabled = false; }); }
  }

  $("#cc-medir").addEventListener("click", () => run(null, "Sacando fotos…", async () => {
    await snapAll();
    msg("Listo. Marcá en cada foto la zona neutra (arrastrando) y tocá Igualar.");
  }));

  $("#cc-igualar").addEventListener("click", () => run(null, "Igualando…", async () => {
    const ref = $("#cc-ref").value;
    const list = inputsList();
    if (!list.includes(ref)) throw new Error("Elegí la cámara patrón");
    // 1) Todas en Gain 1, para medir el color real de cada camara.
    await vmixCalls(list.flatMap(i => gainCalls(i, { r: 1, g: 1, b: 1 })));
    applied = {}; store.set("applied", applied);
    await new Promise(resolve => setTimeout(resolve, 400));
    await snapAll();
    const refCam = cams.find(c => c.input === ref);
    if (!refCam?.stats) throw new Error("No pude medir la cámara patrón (¿zona muy oscura o quemada?)");
    baseStats = Object.fromEntries(cams.filter(c => c.stats).map(c => [c.input, c.stats]));
    // 2) Gain de cada canal = patrón / cámara (limitado para no exagerar).
    const clamp = v => Math.max(0.5, Math.min(1.8, v));
    const calls = [];
    const omitted = [];
    for (const cam of cams) {
      if (cam.input === ref) continue;
      if (!cam.stats) { omitted.push(cam.input); continue; }
      const g = { r: clamp(refCam.stats.r / cam.stats.r), g: clamp(refCam.stats.g / cam.stats.g), b: clamp(refCam.stats.b / cam.stats.b) };
      applied[cam.input] = g;
      calls.push(...gainCalls(cam.input, g));
    }
    if (calls.length) await vmixCalls(calls);
    store.set("applied", applied);
    render();
    msg(`Igualadas ${Object.keys(applied).length} cámaras con el input ${ref}${omitted.length ? ` (sin medir: ${omitted.join(", ")})` : ""}. Tocá Verificar para ver cómo quedaron.`);
  }));

  $("#cc-verificar").addEventListener("click", () => run(null, "Verificando…", async () => {
    await snapAll();
    // Si la foto de vMix no cambio aunque se aplico Gain, la foto no incluye la correccion.
    const sinCambio = cams.filter(c => {
      const g = applied[c.input], b = baseStats[c.input];
      if (!g || !b || !c.stats) return false;
      const big = Math.max(Math.abs(g.r - 1), Math.abs(g.g - 1), Math.abs(g.b - 1)) > 0.05;
      const same = ["r", "g", "b"].every(ch => Math.abs(c.stats[ch] / b[ch] - 1) < 0.02);
      return big && same;
    });
    msg(sinCambio.length
      ? "La foto que da vMix no muestra la corrección aplicada: revisá cómo quedó en el multiview o en la vista previa de vMix."
      : "Fotos nuevas: mirá el porcentaje \"vs patrón\" de cada cámara (cerca de 0% = igualada).");
  }));

  $("#cc-reset").addEventListener("click", () => run(null, "Restableciendo…", async () => {
    const list = inputsList();
    await vmixCalls(list.flatMap(i => gainCalls(i, { r: 1, g: 1, b: 1 })));
    applied = {}; store.set("applied", applied);
    render();
    msg("Gain en 1 en todas las cámaras.");
  }));

  $("#cc-inputs").value = store.get("inputs", "1,2,3,4,5");
  $("#cc-inputs").addEventListener("change", () => { store.set("inputs", $("#cc-inputs").value); fillRef(); });
  $("#cc-ref").addEventListener("change", () => { store.set("ref", $("#cc-ref").value); render(); });
  $("#cc-mode").value = store.get("mode", "zona");
  $("#cc-mode").addEventListener("change", () => { store.set("mode", $("#cc-mode").value); cams.forEach(c => { if (c.img) c.stats = measure(c.img, regions[c.input]); }); render(); });
  fillRef();

  window.panelColor = { measure, cams: () => cams };
})();
