const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode-terminal");
const mysql = require("mysql2/promise");
const { addTask } = require("./queue");
const config = require("../../config");

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const SESSION_KEY = "default_session_backup";

const pool = mysql.createPool({
  uri: config.MYSQL_URI,
  waitForConnections: true,
  connectionLimit: 5
});

/* -------------------------- DB SESSION TABLE -------------------------- */
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_sessions (
      session VARCHAR(255) PRIMARY KEY,
      data LONGBLOB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
  console.log("📁 Table wa_sessions OK");
}

/* --------------------------- SAVE AUTH TO DB -------------------------- */
async function saveAuthToDb(session = SESSION_KEY) {
  try {
    if (!(await fs.pathExists(AUTH_DIR))) {
      console.warn("Auth dir not found, nothing to save.");
      return;
    }

    const files = await fs.readdir(AUTH_DIR);
    const map = {};

    for (const f of files) {
      const buf = await fs.readFile(path.join(AUTH_DIR, f));
      map[f] = buf.toString("base64");
    }

    const blob = Buffer.from(JSON.stringify(map));
    await pool.query(
      "REPLACE INTO wa_sessions (session, data) VALUES (?, ?)",
      [session, blob]
    );

    console.log("💾 Auth saved into MySQL.");
  } catch (err) {
    console.error("Failed saveAuthToDb:", err);
  }
}

/* ------------------------- RESTORE AUTH FROM DB ----------------------- */
async function restoreAuthFromDb(session = SESSION_KEY) {
  try {
    const [rows] = await pool.query(
      "SELECT data FROM wa_sessions WHERE session = ?",
      [session]
    );

    if (!rows.length) {
      console.log("No auth in DB.");
      return false;
    }

    const map = JSON.parse(rows[0].data.toString());
    await fs.ensureDir(AUTH_DIR);

    const existing = await fs.readdir(AUTH_DIR).catch(() => []);
    for (const f of existing) await fs.remove(path.join(AUTH_DIR, f));

    for (const [name, b64] of Object.entries(map)) {
      await fs.writeFile(
        path.join(AUTH_DIR, name),
        Buffer.from(b64, "base64")
      );
    }

    console.log("📦 Auth restored to ./auth");
    return true;
  } catch (err) {
    console.error("Failed restoreAuthFromDb:", err);
    return false;
  }
}

/* ----------------------------- WA SOCKET ------------------------------- */
let sock = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

async function startWA(onMessage, onReady) {
  await ensureTable();

  const hasLocal = (await fs.pathExists(AUTH_DIR))
    && (await fs.readdir(AUTH_DIR)).length > 0;

  if (!hasLocal) {
    console.log("No local auth — attempt restore DB…");
    await restoreAuthFromDb();
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    browser: ["BridgeBot", "Chrome", "1.0"],
    syncFullHistory: false,
  });

  /* AUTO SAVE CREDS */
  sock.ev.on("creds.update", async () => {
    await saveCreds();
    await saveAuthToDb();
  });

  /* CONNECTION EVENTS */
  sock.ev.on("connection.update", async (u) => {
    const { connection, qr, lastDisconnect } = u;

    if (qr) {
      console.log("🔗 Scan QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      reconnectAttempts = 0;
      console.log("WA Ready!");
      if (onReady) onReady(sock);
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.warn("WA closed", code);

      if (code === DisconnectReason.loggedOut) {
        await fs.remove(AUTH_DIR);
        await pool.query("DELETE FROM wa_sessions WHERE session = ?", [SESSION_KEY]);
        sock = null;
        return;
      }

      reconnectAttempts++;
      if (reconnectAttempts > maxReconnectAttempts) {
        console.error("Reconnect limit reached.");
        sock = null;
        return;
      }

      const wait = Math.min(30000, 1000 * (2 ** reconnectAttempts));
      setTimeout(() => startWA(onMessage, onReady), wait);
    }
  });

  /* MESSAGE HANDLER */
  sock.ev.on("messages.upsert", async (m) => {
    if (!m.messages[0]?.message) return;
    if (onMessage) await onMessage(sock, m.messages[0]);
  });

  return sock;
}

async function sendToWA(jid, text) {
  if (!sock) throw new Error("Socket not initialized");
  return addTask(jid, text, async (to, msg) => {
    await sock.sendMessage(to, { text: msg });
  });
}

module.exports = { startWA, sendToWA, restoreAuthFromDb, saveAuthToDb };
