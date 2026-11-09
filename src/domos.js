// Control de domos (PTZ). Un "driver" por marca, porque los comandos cambian.
// Adaptado de PanelGoLlegadas (lib/domos.mjs).
// Foscam: API CGI (CGIProxy.fcgi). Longse (y cualquier camara ONVIF): ONVIF por SOAP, sin librerias externas.
const http = require("http");
const crypto = require("crypto");
const dgram = require("dgram");
const os = require("os");

const MARCAS = ["foscam", "longse", "onvif"];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tag = (xml, name) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml); return m ? m[1] : ""; };
const decode = text => { try { return decodeURIComponent(text); } catch { return text; } };
const DIRECCIONES = ["arriba", "abajo", "izq", "der", "arriba-izq", "arriba-der", "abajo-izq", "abajo-der"];

function httpGet(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("La cámara no responde (revisá IP y puerto)")));
    req.on("error", error => reject(error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH" || error.code === "ETIMEDOUT"
      ? new Error(`No se puede conectar a la cámara (${error.code}). Revisá IP, puerto y red/ZeroTier.`)
      : error));
  });
}

// Pedido HTTP con usuario/clave: prueba sin autenticar y, si la camara pide Digest o Basic, repite.
function httpRequest(method, url, { body = null, headers = {}, user = "", pass = "", timeoutMs = 6000 } = {}) {
  const once = extraHeaders => new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? Buffer.from(body) : null;
    const req = http.request({ method, hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search,
      headers: { ...headers, ...extraHeaders, ...(payload ? { "Content-Length": payload.length } : {}) } }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("La cámara no responde (revisá IP y puerto)")));
    req.on("error", error => reject(["ECONNREFUSED", "EHOSTUNREACH", "ETIMEDOUT", "ENETUNREACH"].includes(error.code)
      ? new Error(`No se puede conectar a la cámara (${error.code}). Revisá IP, puerto y red.`) : error));
    if (payload) req.write(payload);
    req.end();
  });
  return once({}).then(res => {
    const auth = String(res.headers["www-authenticate"] || "");
    if (res.status !== 401 || !user) return res;
    if (/^digest/i.test(auth)) {
      const field = name => (new RegExp(`${name}="?([^",]+)"?`, "i").exec(auth) || [])[1] || "";
      const realm = field("realm"), nonce = field("nonce"), qop = /auth/.test(field("qop")) ? "auth" : "", opaque = field("opaque");
      const u = new URL(url), uri = u.pathname + u.search;
      const md5 = t => crypto.createHash("md5").update(t).digest("hex");
      const nc = "00000001", cnonce = crypto.randomBytes(8).toString("hex");
      const ha1 = md5(`${user}:${realm}:${pass}`), ha2 = md5(`${method}:${uri}`);
      const response = qop ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
      let header = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
      if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
      if (opaque) header += `, opaque="${opaque}"`;
      return once({ Authorization: header });
    }
    return once({ Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") });
  });
}

// ---------- ONVIF (Longse y otras) ----------
const NS = {
  device: "http://www.onvif.org/ver10/device/wsdl",
  media: "http://www.onvif.org/ver10/media/wsdl",
  ptz: "http://www.onvif.org/ver20/ptz/wsdl",
  schema: "http://www.onvif.org/ver10/schema"
};
const xmlEsc = t => String(t).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[c]));
const xtag = (xml, name) => { const m = new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`).exec(xml); return m ? m[1].trim() : ""; };
const onvifCache = new Map();   // datos de cada camara (servicios, perfil, diferencia de hora)

function onvif(cam) {
  const user = cam.usuario || "admin", pass = cam.clave || "";
  const deviceUrl = `http://${cam.host}:${cam.puerto || 80}${cam.ruta || "/onvif/device_service"}`;
  const key = `${deviceUrl}|${user}|${pass}`;
  const info = onvifCache.get(key) || {};
  onvifCache.set(key, info);

  function security() {
    const nonce = crypto.randomBytes(16);
    const created = new Date(Date.now() + (info.offset || 0)).toISOString().replace(/\.\d+Z$/, "Z");
    const digest = crypto.createHash("sha1").update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(pass)])).digest("base64");
    return `<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><UsernameToken><Username>${xmlEsc(user)}</Username><Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password><Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-soap-message-security-1.0#Base64Binary">${nonce.toString("base64")}</Nonce><Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created></UsernameToken></Security>`;
  }
  async function soap(url, inner, { auth = true } = {}) {
    const envelope = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Header>${auth ? security() : ""}</s:Header><s:Body>${inner}</s:Body></s:Envelope>`;
    const res = await httpRequest("POST", url, { body: envelope, headers: { "Content-Type": "application/soap+xml; charset=utf-8" }, user, pass });
    const text = res.body.toString("utf8");
    if (res.status === 401 || /NotAuthorized|not authorized|Sender not Authorized/i.test(text)) throw new Error("Usuario o clave incorrectos (ONVIF)");
    if (res.status >= 400 || /<(?:\w+:)?Fault>/.test(text)) {
      const reason = xtag(xtag(text, "Reason"), "Text") || xtag(text, "Text") || `HTTP ${res.status}`;
      throw new Error(`La cámara rechazó el comando ONVIF: ${reason.replace(/<[^>]+>/g, "").slice(0, 160)}`);
    }
    return text;
  }
  async function init() {
    if (info.profile) return info;
    // Hora de la camara (sin clave): la seguridad ONVIF falla si la hora difiere mucho.
    try {
      const t = await soap(deviceUrl, `<GetSystemDateAndTime xmlns="${NS.device}"/>`, { auth: false });
      const utc = xtag(t, "UTCDateTime");
      const n = name => Number(xtag(utc, name));
      if (utc) info.offset = Date.UTC(n("Year"), n("Month") - 1, n("Day"), n("Hour"), n("Minute"), n("Second")) - Date.now();
    } catch {}
    const caps = await soap(deviceUrl, `<GetCapabilities xmlns="${NS.device}"><Category>All</Category></GetCapabilities>`);
    const fix = u => { try { const x = new URL(u); x.hostname = cam.host; if (!x.port || x.port === "80") x.port = String(cam.puerto || 80); return x.toString(); } catch { return u; } };
    info.mediaUrl = fix(xtag(xtag(caps, "Media"), "XAddr") || deviceUrl);
    info.ptzUrl = fix(xtag(xtag(caps, "PTZ"), "XAddr") || "");
    if (!info.ptzUrl) throw new Error("La cámara no informa control PTZ por ONVIF");
    const profiles = await soap(info.mediaUrl, `<GetProfiles xmlns="${NS.media}"/>`);
    const all = [...profiles.matchAll(/<(?:\w+:)?Profiles\b[^>]*token="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?Profiles>/g)];
    const withPtz = all.find(m => /PTZConfiguration/.test(m[2])) || all[0];
    if (!withPtz) throw new Error("La cámara no devolvió perfiles ONVIF");
    info.profile = withPtz[1];
    return info;
  }
  const VEL = 0.5;
  const DIR = {
    arriba: [0, VEL], abajo: [0, -VEL], izq: [-VEL, 0], der: [VEL, 0],
    "arriba-izq": [-VEL, VEL], "arriba-der": [VEL, VEL], "abajo-izq": [-VEL, -VEL], "abajo-der": [VEL, -VEL]
  };
  async function presets() {
    await init();
    const t = await soap(info.ptzUrl, `<GetPresets xmlns="${NS.ptz}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken></GetPresets>`);
    return [...t.matchAll(/<(?:\w+:)?Preset\b[^>]*token="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?Preset>/g)].map(m => ({ token: m[1], nombre: xtag(m[2], "Name") }));
  }
  const reintentar = async fn => { try { return await fn(); } catch (error) { if (/conectar|responde/.test(error.message)) throw error; info.profile = null; return fn(); } };
  return {
    async probar() {
      const t = await soap(deviceUrl, `<GetDeviceInformation xmlns="${NS.device}"/>`);
      await init();
      return { nombre: [xtag(t, "Manufacturer"), xtag(t, "Model")].filter(Boolean).join(" ") || "Cámara ONVIF" };
    },
    async mover(dir) {
      const v = DIR[dir];
      if (!v) throw new Error("Dirección inválida");
      await reintentar(async () => { await init(); await soap(info.ptzUrl, `<ContinuousMove xmlns="${NS.ptz}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken><Velocity><PanTilt x="${v[0]}" y="${v[1]}" xmlns="${NS.schema}"/></Velocity></ContinuousMove>`); });
    },
    async zoom(dir) {
      await reintentar(async () => { await init(); await soap(info.ptzUrl, `<ContinuousMove xmlns="${NS.ptz}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken><Velocity><Zoom x="${dir === "mas" ? VEL : -VEL}" xmlns="${NS.schema}"/></Velocity></ContinuousMove>`); });
    },
    async parar() {
      await init();
      await soap(info.ptzUrl, `<Stop xmlns="${NS.ptz}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken><PanTilt>true</PanTilt><Zoom>true</Zoom></Stop>`);
    },
    async guardarPreset(n) {
      const nombre = "PG" + Number(n);
      const existente = (await presets()).find(p => p.nombre === nombre);
      await soap(info.ptzUrl, `<SetPreset xmlns="${NS.ptz}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken><PresetName>${nombre}</PresetName>${existente ? `<PresetToken>${xmlEsc(existente.token)}</PresetToken>` : ""}</SetPreset>`);
    },
    async irPreset(n) {
      const nombre = "PG" + Number(n);
      const p = (await presets()).find(x => x.nombre === nombre);
      if (!p) throw new Error(`La posición ${n} todavía no está guardada en esta cámara`);
      await soap(info.ptzUrl, `<GotoPreset xmlns="${NS.ptz}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken><PresetToken>${xmlEsc(p.token)}</PresetToken></GotoPreset>`);
    },
    async snapshot() {
      await init();
      if (!info.snapUrl) {
        const t = await soap(info.mediaUrl, `<GetSnapshotUri xmlns="${NS.media}"><ProfileToken>${xmlEsc(info.profile)}</ProfileToken></GetSnapshotUri>`);
        const uri = xtag(t, "Uri").replace(/&amp;/g, "&");
        if (!uri) throw new Error("La cámara no da foto por ONVIF");
        info.snapUrl = (() => { try { const x = new URL(uri); x.hostname = cam.host; return x.toString(); } catch { return uri; } })();
      }
      const res = await httpRequest("GET", info.snapUrl, { user, pass, timeoutMs: 8000 });
      return { status: res.status, type: String(res.headers["content-type"] || ""), body: res.body };
    }
  };
}

// Busca camaras ONVIF en la red local (WS-Discovery). En ZeroTier puede no encontrarlas: ahi se carga la IP a mano.
function buscarOnvif(timeoutMs = 3500) {
  const probe = id => `<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl"><e:Header><w:MessageID>uuid:${id}</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`;
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === "IPv4" && !a.internal).map(a => a.address);
  const found = new Map();
  return new Promise(resolve => {
    const sockets = [];
    for (const local of addrs.length ? addrs : ["0.0.0.0"]) {
      const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
      sockets.push(sock);
      sock.on("error", () => {});
      sock.on("message", (buf, rinfo) => {
        const text = buf.toString("utf8");
        for (const xaddr of xtag(text, "XAddrs").split(/\s+/).filter(Boolean)) {
          try {
            const u = new URL(xaddr);
            if (u.hostname.includes(":")) continue;
            const scopes = decode(xtag(text, "Scopes"));
            const scope = name => (new RegExp(`onvif://www.onvif.org/${name}/([^\\s]+)`).exec(scopes) || [])[1] || "";
            const k = `${u.hostname}:${u.port || 80}`;
            if (!found.has(k)) found.set(k, { host: u.hostname, puerto: Number(u.port || 80), ruta: u.pathname, nombre: decode(scope("name")).replace(/_/g, " "), modelo: decode(scope("hardware")), desde: rinfo.address });
          } catch {}
        }
      });
      sock.bind(0, local === "0.0.0.0" ? undefined : local, () => {
        const msg = Buffer.from(probe(crypto.randomUUID()));
        try { sock.send(msg, 3702, "239.255.255.250"); } catch {}
      });
    }
    setTimeout(() => { sockets.forEach(s => { try { s.close(); } catch {} }); resolve([...found.values()]); }, timeoutMs);
  });
}

// Prueba los puertos ONVIF tipicos de una IP (sin clave: GetSystemDateAndTime).
async function detectarOnvif(host) {
  const puertos = [80, 8000, 8899, 8080, 2000, 5000, 8081, 81, 10080, 8999, 888, 6688];
  const rutas = ["/onvif/device_service"];
  const body = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body></s:Envelope>`;
  const intentos = puertos.flatMap(puerto => rutas.map(ruta => httpRequest("POST", `http://${host}:${puerto}${ruta}`, { body, headers: { "Content-Type": "application/soap+xml; charset=utf-8" }, timeoutMs: 2500 })
    .then(res => /SystemDateAndTime|Envelope/i.test(res.body.toString("utf8")) ? { host, puerto, ruta, nombre: "", modelo: "", desde: "puertos" } : null)
    .catch(() => null)));
  return (await Promise.all(intentos)).filter(Boolean);
}

// ---------- Foscam ----------
function foscam(cam) {
  const base = `http://${cam.host}:${cam.puerto || 88}/cgi-bin/CGIProxy.fcgi`;
  const auth = `usr=${encodeURIComponent(cam.usuario || "admin")}&pwd=${encodeURIComponent(cam.clave || "")}`;
  const url = (cmd, extra = "") => `${base}?cmd=${cmd}${extra}&${auth}`;
  const cgi = async (cmd, extra = "") => {
    const res = await httpGet(url(cmd, extra));
    const text = res.body.toString("utf8");
    const result = /<result>\s*(-?\d+)\s*<\/result>/.exec(text);
    if (result && result[1] !== "0") {
      const motivo = { "-1": "formato de pedido", "-2": "usuario o clave incorrectos", "-3": "error de acceso", "-4": "falló el comando", "-5": "tiempo de espera" }[result[1]] || `código ${result[1]}`;
      throw new Error(`La cámara rechazó ${cmd}: ${motivo}`);
    }
    return text;
  };
  const MOV = {
    arriba: "ptzMoveUp", abajo: "ptzMoveDown", izq: "ptzMoveLeft", der: "ptzMoveRight",
    "arriba-izq": "ptzMoveTopLeft", "arriba-der": "ptzMoveTopRight", "abajo-izq": "ptzMoveBottomLeft", "abajo-der": "ptzMoveBottomRight"
  };
  const nombrePreset = n => "PG" + Number(n);
  return {
    async probar() {
      const text = await cgi("getDevInfo");
      if (!/<result>\s*0\s*<\/result>/.test(text)) throw new Error("No respondió como Foscam (revisá IP, puerto, usuario y clave)");
      const nombre = /<devName>(.*?)<\/devName>/.exec(text)?.[1];
      return { nombre: nombre || "Foscam" };
    },
    async mover(dir) { const c = MOV[dir]; if (!c) throw new Error("Dirección inválida"); await cgi(c); },   // empieza a moverse (continuo)
    async zoom(dir) { await cgi(dir === "mas" ? "zoomIn" : "zoomOut"); },                                  // empieza el zoom
    async parar() { await cgi("ptzStopRun"); await cgi("zoomStop"); },
    async guardarPreset(n) { await cgi("ptzAddPresetPoint", `&name=${nombrePreset(n)}`); },
    async irPreset(n) { await cgi("ptzGotoPresetPoint", `&name=${nombrePreset(n)}`); },
    snapshotUrl: () => url("snapPicture2"),
    async snapshot() { const r = await httpGet(url("snapPicture2"), 8000); return { status: r.status, type: String(r.headers["content-type"] || ""), body: r.body }; },
    // Senal WiFi segun la propia camara: escanea las redes que ve y toma la calidad (0-100) de la red a la que esta conectada.
    async wifi() {
      const cfg = await cgi("getWifiConfig");
      const conectada = decode(tag(cfg, "ssid"));
      const usaWifi = tag(cfg, "isUseWifi") === "1";
      await cgi("refreshWifiList");
      await sleep(4000);                      // la camara tarda unos segundos en escanear
      const redes = [];
      for (let start = 0, total = 1; start < total && start < 60; start += 10) {
        const list = await cgi("getWifiList", `&startNo=${start}`);
        total = Number(tag(list, "totalCnt")) || 0;
        const cur = Number(tag(list, "curCnt")) || 0;
        for (let i = 0; i < cur; i++) {
          const parts = decode(tag(list, `ap${i}`)).split("+");
          if (parts.length < 5) continue;
          const n = parts.length;
          redes.push({ ssid: parts.slice(0, n - 4).join("+"), mac: parts[n - 4], calidad: Number(parts[n - 3]) || 0 });
        }
        if (!cur) break;
      }
      redes.sort((a, b) => b.calidad - a.calidad);
      const propia = redes.filter(r => r.ssid === conectada).sort((a, b) => b.calidad - a.calidad)[0];
      return { usaWifi, ssid: conectada, calidad: propia ? propia.calidad : null, redes: redes.slice(0, 8) };
    },
    // Video MJPEG (si la camara lo tiene: usa el sub-stream en formato MJPEG).
    mjpegUrl: () => `http://${cam.host}:${cam.puerto || 88}/cgi-bin/CGIStream.cgi?cmd=GetMJStream&${auth}`
  };
}

// Como llega la camara al panel: tiempo de respuesta (5 pedidos) y velocidad con una foto.
async function medirRed(dv, probar) {
  const tiempos = [];
  let errores = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    try { await probar(); tiempos.push(Date.now() - t0); } catch { errores++; }
  }
  let foto = null;
  if (dv.snapshot) {
    try {
      const t0 = Date.now();
      const shot = await dv.snapshot();
      if (shot.status !== 200) throw new Error("sin foto");
      const ms = Math.max(1, Date.now() - t0);
      foto = { kb: Math.round(shot.body.length / 1024), ms, mbps: Math.round((shot.body.length * 8 / 1e6) / (ms / 1000) * 10) / 10 };
    } catch { errores++; }
  }
  const prom = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null;
  return { respuestaMs: prom, respuestaMax: tiempos.length ? Math.max(...tiempos) : null, errores, pedidos: 6, foto };
}

// ---------- registro por marca ----------
function crearDomo(cam) {
  if (!cam || !cam.host) throw new Error("Elegí una cámara y cargá la IP (y guardala)");
  const marca = String(cam.marca || "foscam").toLowerCase();
  if (marca === "foscam") return foscam(cam);
  if (marca === "longse" || marca === "onvif") return onvif(cam);
  throw new Error("Marca desconocida: " + marca);
}

module.exports = { crearDomo, medirRed, buscarOnvif, detectarOnvif, httpGet, MARCAS, DIRECCIONES };
