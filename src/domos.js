// Control de domos (PTZ). Un "driver" por marca, porque los comandos cambian.
// Adaptado de PanelGoLlegadas (lib/domos.mjs).
// Foscam: API CGI (CGIProxy.fcgi). Longse: ONVIF (se activa cuando se conecte la camara para probar).
const http = require("http");

const MARCAS = ["foscam", "longse"];
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
    snapshotUrl: () => url("snapPicture2")
  };
}

// ---------- registro por marca ----------
function crearDomo(cam) {
  if (!cam || !cam.host) throw new Error("Elegí una cámara y cargá la IP (y guardala)");
  const marca = String(cam.marca || "foscam").toLowerCase();
  if (marca === "foscam") return foscam(cam);
  if (marca === "longse" || marca === "onvif") throw new Error("Longse (ONVIF) se activa cuando conectes la cámara: lo probamos con la cámara conectada. Por ahora anda Foscam.");
  throw new Error("Marca desconocida: " + marca);
}

module.exports = { crearDomo, httpGet, MARCAS, DIRECCIONES };
