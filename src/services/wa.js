// src/services/wa.js
const config = require("../../config");
const { startWA, sendToWA, restoreAuthFromDb, saveAuthToDb } = require("../whatsapp");
let sockRef = null;
let status = "stopped"; // stopped | connecting | qr | connected | disconnected
let lastQr = null;

function getStatus() {
  return status;
}

function getLastQr() {
  return lastQr;
}

async function start() {
  if (sockRef) return sockRef;
  status = "connecting";

  // provide minimal onMessage (we won't override main bot handler if it exists)
  const onMessage = async (sock, msg) => {
    // no-op (actual bot handler lives in src/index.js). Keep lightweight.
  };

  const onReady = async (sock) => {
    status = "connected";
    // listen extra connection.update events to capture QR changes
    try {
      sock.ev.on("connection.update", update => {
        const { qr, connection } = update;
        if (qr) {
          lastQr = qr;
          status = "qr";
        }
        if (connection === "open") {
          status = "connected";
          lastQr = null;
        }
        if (connection === "close") {
          // if disconnected but not intentionally logged out, set disconnected
          if (status !== "stopping") status = "disconnected";
        }
      });
    } catch (e) {
      // ignore if ev not available
    }
  };

  try {
    sockRef = await startWA(onMessage, onReady);
    // sockRef may emit connection.update - we also add a listener here
    if (sockRef?.ev) {
      sockRef.ev.on("connection.update", (u) => {
        if (u.qr) {
          lastQr = u.qr;
          status = "qr";
        } else if (u.connection === "open") {
          lastQr = null;
          status = "connected";
        } else if (u.connection === "close") {
          // leave status change to onReady's handler logic
          if (status !== "stopping") status = "disconnected";
        }
      });
    }
    return sockRef;
  } catch (err) {
    console.error("services/wa.start error:", err);
    status = "error";
    throw err;
  }
}

async function triggerRestoreFromDb() {
  // convenience wrapper
  return restoreAuthFromDb();
}

async function triggerSaveAuthToDb() {
  return saveAuthToDb();
}

async function send(to, text) {
  return sendToWA(to, text);
}

async function logout() {
  try {
    status = "stopping";
    if (!sockRef) return;
    // attempt to logout gracefully
    try { await sockRef.logout(); } catch (e) { /* ignore */ }
    sockRef = null;
    status = "disconnected";
  } catch (e) {
    console.error("services/wa.logout error:", e);
  }
}

module.exports = {
  start,
  getStatus,
  getLastQr,
  triggerRestoreFromDb,
  triggerSaveAuthToDb,
  send,
  logout
};
