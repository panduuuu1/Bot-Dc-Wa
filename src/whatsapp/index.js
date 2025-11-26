// src/whatsapp/index.js
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

const pool = mysql.createPool({ uri: config.MYSQL_URI, waitForConnections: true, connectionLimit: 5 });

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

async function saveAuthToDb(session = SESSION_KEY) {
  try {
    if (!(await fs.pathExists(AUTH_DIR))) {
      console.warn("Auth dir not found, nothing to save.");
      return;
    }
    const files = await fs.readdir(AUTH_DIR);
    const map = {};
    for (const f of files) {
      const p = path.join(AUTH_DIR, f);
      const stat = await fs.stat(p);
      if (stat.isFile()) {
        const buf = await fs.readFile(p);
        map[f] = buf.toString("base64");
      }
    }
    const blob = Buffer.from(JSON.stringify(map));
    await pool.query("REPLACE INTO wa_sessions (session, data) VALUES (?, ?)", [session, blob]);
    console.log("💾 Auth saved into MySQL.");
  } catch (err) {
    console.error("Failed saveAuthToDb:", err);
  }
}

async function restoreAuthFromDb(session = SESSION_KEY) {
  try {
    const [rows] = await pool.query("SELECT data FROM wa_sessions WHERE session = ?", [session]);
    if (!rows.length || !rows[0].data) {
      console.log("No auth in DB to restore.");
      return false;
    }
    const blob = rows[0].data;
    const map = JSON.parse(Buffer.isBuffer(blob) ? blob.toString() : blob);
    await fs.ensureDir(AUTH_DIR);
    // clear existing
    const existing = await fs.readdir(AUTH_DIR).catch(()=>[]);
    for (const f of existing) {
      await fs.remove(path.join(AUTH_DIR, f)).catch(()=>{});
    }
    for (const [filename, b64] of Object.entries(map)) {
      const buf = Buffer.from(b64, "base64");
      await fs.writeFile(path.join(AUTH_DIR, filename), buf);
    }
    console.log("📦 Auth restored from DB to ./auth");
    return true;
  } catch (err) {
    console.error("Failed restoreAuthFromDb:", err);
    return false;
  }
}

let sock = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

async function startWA(onMessage, onReady) {
    await ensureTable();

    // try restore if auth dir empty
    const exists = await fs.pathExists(AUTH_DIR);
    const hasFiles = exists ? (await fs.readdir(AUTH_DIR)).length > 0 : false;
    if (!hasFiles) {
      console.log("No local auth files — trying restore from DB...");
      await restoreAuthFromDb(SESSION_KEY);
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
        auth: state,
        browser: ["BridgeBot", "Chrome", "1.0"],
        syncFullHistory: false,
    });

    sock.ev.on("creds.update", async () => {
      try { await saveCreds(); } catch(e){}
      // persist to DB (debounce would be better, keep simple)
      try { await saveAuthToDb(SESSION_KEY); } catch(e){ console.error(e); }
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("🔗 Scan QR berikut untuk login:");
            try { qrcode.generate(qr, { small: true }); } catch(e){ console.log("QR ready"); }
        }

        if (connection === "open") {
            reconnectAttempts = 0;
            console.log("WA Ready!");
            if (typeof onReady === "function") onReady(sock);
        }

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.warn("WA connection closed", code);
            if (code === DisconnectReason.loggedOut) {
                console.warn("Logged out — cleaning local auth and DB entry.");
                await fs.remove(AUTH_DIR).catch(()=>{});
                await pool.query("DELETE FROM wa_sessions WHERE session = ?", [SESSION_KEY]).catch(()=>{});
                sock = null;
            } else {
                // reconnect with backoff
                reconnectAttempts++;
                if (reconnectAttempts > maxReconnectAttempts) {
                  console.error("Max reconnect attempts reached. Stopping reconnection.");
                  sock = null;
                  return;
                }
                const wait = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
                console.log(`Reconnect attempt #${reconnectAttempts} in ${wait}ms`);
                setTimeout(() => startWA(onMessage, onReady).catch(e => console.error(e)), wait);
            }
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg || !msg.message) return;
            if (typeof onMessage === "function") await onMessage(sock, msg);
        } catch (e) {
            console.error("messages.upsert error:", e);
        }
    });

    return sock;
}

async function sendToWA(jid, text) {
    if (!jid) throw new Error("No jid provided to sendToWA");
    if (!sock) throw new Error("WA socket not initialized");
    return addTask(jid, text, async (to, message) => {
        await sock.sendMessage(to, { text: message });
    });
}

module.exports = { startWA, sendToWA, restoreAuthFromDb, saveAuthToDb };

