const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.json({ limit: "30kb" }));
app.use(express.static(__dirname));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SAVE_FILE = path.join(DATA_DIR, "player-saves.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

function readSaves() {
  try { return JSON.parse(fs.readFileSync(SAVE_FILE, "utf8")); }
  catch { return {}; }
}
let saves = readSaves();
function safeId(value) {
  return /^[a-zA-Z0-9_-]{8,100}$/.test(String(value || "")) ? String(value) : null;
}
function cleanSave(input) {
  const m = input && input.mission || {};
  const num = (v, max) => Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Number(v))) : 0;
  const owned = Array.isArray(input && input.ownedSkins)
    ? [...new Set(input.ownedSkins.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < 12))]
    : [0];
  if (!owned.includes(0)) owned.push(0);
  const equipped = num(input && input.equippedSkin, 11);
  return {
    version: 1,
    name: String(input && input.name || "Jugador").replace(/[<>]/g, "").slice(0, 18),
    mission: {
      index: Math.floor(num(m.index, 10000)),
      progress: num(m.progress, 100000000),
      coins: Math.floor(num(m.coins, 100000000)),
      distance: num(m.distance, 1000000000),
      jumps: Math.floor(num(m.jumps, 100000000)),
      seconds: num(m.seconds, 100000000)
    },
    lootCoins: Math.floor(num(input && input.lootCoins, 100000000)),
    ownedSkins: owned,
    equippedSkin: owned.includes(equipped) ? equipped : 0,
    updatedAt: new Date().toISOString()
  };
}
function writeSaves() {
  const temp = SAVE_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(saves));
  fs.renameSync(temp, SAVE_FILE);
}
app.get("/api/save/:id", (req, res) => {
  const id = safeId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID no válido" });
  res.json({ save: saves[id] || null });
});
app.post("/api/save/:id", (req, res) => {
  const id = safeId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID no válido" });
  saves[id] = cleanSave(req.body || {});
  try { writeSaves(); res.json({ ok: true, updatedAt: saves[id].updatedAt }); }
  catch (err) { console.error("No se pudo guardar:", err); res.status(500).json({ error: "No se pudo guardar" }); }
});
app.get("/health", (_req, res) => res.json({ ok: true, game: "Mundo Vivo 3.7" }));

const rooms = new Map();
function cleanText(value, max) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}
io.on("connection", (socket) => {
  socket.on("join-room", ({ room, name } = {}) => {
    room = cleanText(room, 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
    name = cleanText(name, 18) || "Jugador";
    if (!room) return socket.emit("network-error", "Código de sala no válido.");
    const players = rooms.get(room) || new Map();
    const existingPlayers = [...players.entries()].map(([id, p]) => ({ id, ...p }));
    socket.join(room);
    socket.data.room = room;
    socket.data.name = name;
    players.set(socket.id, { name, x: 0, y: 0, z: 0, dir: 0, walk: 0, color: "#2879d0" });
    rooms.set(room, players);
    socket.emit("room-joined", { room, count: players.size, players: existingPlayers });
    socket.to(room).emit("player-joined", { id: socket.id, name, x: 0, y: 0, z: 0, dir: 0, walk: 0, color: "#2879d0" });
    io.to(room).emit("player-count", players.size);
  });
  socket.on("player-state", (state = {}) => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const players = rooms.get(room), old = players.get(socket.id);
    if (!old) return;
    const safe = {
      ...old,
      x: Number.isFinite(state.x) ? Math.max(-1000000, Math.min(1000000, state.x)) : old.x,
      y: Number.isFinite(state.y) ? Math.max(-1000000, Math.min(1000000, state.y)) : old.y,
      z: Number.isFinite(state.z) ? Math.max(0, Math.min(2000, state.z)) : old.z,
      dir: Number.isFinite(state.dir) ? state.dir : old.dir,
      walk: Number.isFinite(state.walk) ? state.walk : old.walk
    };
    players.set(socket.id, safe);
    socket.to(room).volatile.emit("player-state", { id: socket.id, ...safe });
  });
  socket.on("world-chat", message => {
    const room = socket.data.room;
    if (!room) return;
    const msg = cleanText(message, 180);
    if (msg) io.to(room).emit("world-chat", { name: socket.data.name || "Jugador", message: msg });
  });
  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const players = rooms.get(room);
    players.delete(socket.id);
    socket.to(room).emit("player-left", socket.id);
    if (!players.size) rooms.delete(room);
    else io.to(room).emit("player-count", players.size);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Mundo Vivo 3.7 listo en el puerto ${PORT}`));
