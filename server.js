"use strict";
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Render usa proxy: necesario para ver la IP real
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 20 * 1024,
  pingInterval: 20000,
  pingTimeout: 25000
});
app.use(express.json({ limit: "30kb" }));

/* ---------- Archivos públicos ----------
   ANTES se servía toda la carpeta (express.static(__dirname)), lo que dejaba
   descargable server.js y data/player-saves.json (con los IDs de todos los
   jugadores). Ahora solo se publica index.html. */
const INDEX_FILE = path.join(__dirname, "index.html");
app.get(["/", "/index.html"], (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(INDEX_FILE);
});

/* ---------- Guardado ---------- */
const SKIN_COUNT = 12;
const MAX_PROFILES = 200000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SAVE_FILE = path.join(DATA_DIR, "player-saves.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

function readSaves() {
  let raw;
  try { raw = fs.readFileSync(SAVE_FILE, "utf8"); }
  catch { return {}; }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    // Archivo dañado: se conserva una copia en vez de perder todo en silencio.
    const backup = SAVE_FILE + ".corrupt-" + Date.now();
    try { fs.copyFileSync(SAVE_FILE, backup); } catch {}
    console.error("player-saves.json dañado, copia en", backup);
    return {};
  }
}
let saves = readSaves();

function safeId(value) {
  return /^[a-zA-Z0-9_-]{8,100}$/.test(String(value || "")) ? String(value) : null;
}
function num(v, max) {
  v = Number(v);
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
}
function cleanSave(input) {
  input = input && typeof input === "object" ? input : {};
  const m = input.mission && typeof input.mission === "object" ? input.mission : {};
  // v2 guarda una sola cartera (wallet). Las partidas v1 usaban coins + lootCoins - 22.
  const wallet = input.wallet !== undefined
    ? num(input.wallet, 1e9)
    : Math.max(0, num(m.coins, 1e9) + num(input.lootCoins, 1e9) - 22);
  const owned = Array.isArray(input.ownedSkins)
    ? [...new Set(input.ownedSkins.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < SKIN_COUNT))]
    : [0];
  if (!owned.includes(0)) owned.push(0);
  const equipped = Math.floor(num(input.equippedSkin, SKIN_COUNT - 1));
  return {
    version: 2,
    name: String(input.name || "Jugador").replace(/[<>]/g, "").slice(0, 18) || "Jugador",
    wallet: Math.floor(wallet),
    mission: {
      index: Math.floor(num(m.index, 10000)),
      progress: num(m.progress, 1e8),
      distance: num(m.distance, 1e10),
      jumps: Math.floor(num(m.jumps, 1e8)),
      seconds: num(m.seconds, 1e8)
    },
    ownedSkins: owned,
    equippedSkin: owned.includes(equipped) ? equipped : 0,
    updatedAt: new Date().toISOString()
  };
}

// Escritura con retardo (varios guardados seguidos = un solo acceso a disco).
let dirty = false, writeTimer = null;
function writeNow() {
  writeTimer = null;
  if (!dirty) return true;
  dirty = false;
  try {
    const temp = SAVE_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(saves));
    fs.renameSync(temp, SAVE_FILE);
    return true;
  } catch (err) {
    dirty = true;
    console.error("No se pudo guardar:", err);
    writeTimer = setTimeout(writeNow, 5000);
    return false;
  }
}
function scheduleWrite() {
  dirty = true;
  if (!writeTimer) writeTimer = setTimeout(writeNow, 1500);
}
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => { writeNow(); process.exit(0); });
}

// Límite sencillo por IP para que nadie sature el guardado.
const hits = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60000).unref();
function rateLimit(req, res, next) {
  const now = Date.now();
  let h = hits.get(req.ip);
  if (!h || h.reset < now) { h = { count: 0, reset: now + 60000 }; hits.set(req.ip, h); }
  if (++h.count > 90) return res.status(429).json({ error: "Demasiadas solicitudes" });
  next();
}

app.get("/api/save/:id", rateLimit, (req, res) => {
  const id = safeId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID no válido" });
  res.set("Cache-Control", "no-store");
  res.json({ save: saves[id] || null });
});
app.post("/api/save/:id", rateLimit, (req, res) => {
  const id = safeId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID no válido" });
  if (!saves[id] && Object.keys(saves).length >= MAX_PROFILES)
    return res.status(507).json({ error: "Servidor lleno" });
  saves[id] = cleanSave(req.body);
  scheduleWrite();
  res.json({ ok: true, updatedAt: saves[id].updatedAt });
});
app.get("/health", (_req, res) => res.json({ ok: true, game: "Mundo Vivo 3.8" }));

/* ---------- Multijugador ---------- */
const MAX_ROOM_PLAYERS = 16;
const rooms = new Map();
function cleanText(value, max) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}
function leaveRoom(socket) {
  const room = socket.data.room;
  if (!room) return;
  socket.leave(room);
  socket.data.room = null;
  const players = rooms.get(room);
  if (!players) return;
  players.delete(socket.id);
  socket.to(room).emit("player-left", socket.id);
  if (!players.size) rooms.delete(room);
  else io.to(room).emit("player-count", players.size);
}

io.on("connection", (socket) => {
  socket.data.lastChat = 0;
  socket.data.lastShot = 0;

  socket.on("join-room", (payload) => {
    const { room: rawRoom, name: rawName } = payload && typeof payload === "object" ? payload : {};
    const room = cleanText(rawRoom, 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const name = cleanText(rawName, 18) || "Jugador";
    if (!room) return socket.emit("network-error", "Código de sala no válido.");
    if (socket.data.room) leaveRoom(socket);
    const players = rooms.get(room) || new Map();
    if (players.size >= MAX_ROOM_PLAYERS)
      return socket.emit("network-error", "La sala está llena (máximo " + MAX_ROOM_PLAYERS + ").");
    const existing = [...players.entries()].map(([id, p]) => ({ id, ...p }));
    const me = { name, x: 0, y: 0, z: 0, dir: 0, walk: 0, skin: 0 };
    socket.join(room);
    socket.data.room = room;
    socket.data.name = name;
    players.set(socket.id, me);
    rooms.set(room, players);
    socket.emit("room-joined", { room, count: players.size, players: existing });
    socket.to(room).emit("player-joined", { id: socket.id, ...me });
    io.to(room).emit("player-count", players.size);
  });

  socket.on("player-state", (state) => {
    const room = socket.data.room;
    const players = room && rooms.get(room);
    const old = players && players.get(socket.id);
    if (!old || !state || typeof state !== "object") return;
    const fin = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
    const skin = Number.isInteger(state.skin) && state.skin >= 0 && state.skin < SKIN_COUNT ? state.skin : old.skin;
    const safe = {
      ...old,
      x: fin(state.x, -1e7, 1e7, old.x),
      y: fin(state.y, -1e7, 1e7, old.y),
      z: fin(state.z, 0, 2000, old.z),
      dir: fin(state.dir, -10, 10, old.dir),
      walk: fin(state.walk, 0, 1e9, old.walk),
      skin
    };
    players.set(socket.id, safe);
    socket.to(room).volatile.emit("player-state", { id: socket.id, ...safe });
  });

  // Disparos: solo se retransmiten para que los demás vean las balas.
  socket.on("player-shoot", (s) => {
    const room = socket.data.room;
    const now = Date.now();
    if (!room || !s || typeof s !== "object" || now - socket.data.lastShot < 100) return;
    socket.data.lastShot = now;
    if (![s.x, s.y, s.a].every(Number.isFinite)) return;
    socket.to(room).volatile.emit("player-shoot", { id: socket.id, x: s.x, y: s.y, a: s.a });
  });

  socket.on("world-chat", (message) => {
    const room = socket.data.room;
    const now = Date.now();
    if (!room || now - socket.data.lastChat < 400) return;
    const msg = cleanText(message, 180);
    if (!msg) return;
    socket.data.lastChat = now;
    // El emisor ya muestra su propio mensaje: se envía solo a los demás.
    socket.to(room).emit("world-chat", { name: socket.data.name || "Jugador", message: msg });
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Mundo Vivo 3.8 listo en el puerto ${PORT}`));
