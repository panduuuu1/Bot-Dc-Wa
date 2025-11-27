// src/services/wa.js
const { startWA, sendToWA, restoreAuthFromDb, saveAuthToDb } = require("../whatsapp");

let sockRef = null;
let status = "stopped";
let lastQr = null;

function getStatus() {
  return status;
}
function getLastQr() {
  return lastQr;
}

async function start(onMessage, onReady) {
  if (sockRef) return sockRef;

  status = "connecting";

  // start WA dengan handler dari index.js
  sockRef = await startWA(
    onMessage,
    (sock) => {
      status = "connected";
      lastQr = null;

      // panggil onReady asli
      if (onReady) onReady(sock);

      sock.ev.on("connection.update", (u) => {
        if (u.qr) {
          lastQr = u.qr;
          status = "qr";
        }
        if (u.connection === "open") {
          lastQr = null;
          status = "connected";
        }
        if (u.connection === "close") {
          if (status !== "stopping") status = "disconnected";
        }
      });
    }
  );

  return sockRef;
}

async function logout() {
  status = "stopping";
  if (!sockRef) return;
  try { await sockRef.logout(); } catch {}
  sockRef = null;
  status = "disconnected";
}

module.exports = {
  start,
  getStatus,
  getLastQr,
  triggerRestoreFromDb: restoreAuthFromDb,
  triggerSaveAuthToDb: saveAuthToDb,
  send: sendToWA,
  logout
};
