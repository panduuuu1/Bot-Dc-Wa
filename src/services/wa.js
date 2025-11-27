// src/services/wa.js
const {
  startWA,
  sendToWA,
  restoreAuthFromDb,
  saveAuthToDb
} = require("../whatsapp");

let sockRef = null;       // referensi socket WA yang sedang aktif
let status = "stopped";   // stopped | connecting | qr | connected | disconnected | stopping
let lastQr = null;        // QR terkini

// ====================== GETTER ====================== //
function getStatus() {
  return status;
}

function getLastQr() {
  return lastQr;
}

// ====================== START SERVICE ====================== //
async function start(onMessageHandler, onReadyHandler) {
  // Jika sudah ada WA aktif → tidak start ulang
  if (sockRef) return sockRef;

  status = "connecting";

  // Handler internal saat WA ready
  const internalReady = (sock) => {
    status = "connected";

    sock.ev.on("connection.update", (u) => {
      // Jika muncul QR baru
      if (u.qr) {
        lastQr = u.qr;
        status = "qr";
      }

      // Jika sudah open
      if (u.connection === "open") {
        lastQr = null;
        status = "connected";
      }

      // Jika koneksi putus
      if (u.connection === "close") {
        if (status !== "stopping") status = "disconnected";
      }
    });

    // Panggil handler ready dari core bot
    if (onReadyHandler) onReadyHandler(sock);
  };

  // Start WA core (dari src/whatsapp/index.js)
  sockRef = await startWA(
    onMessageHandler,  // handler pesan masuk
    internalReady      // handler ready
  );

  return sockRef;
}

// ====================== LOGOUT ====================== //
async function logout() {
  status = "stopping";
  if (!sockRef) return;

  try {
    await sockRef.logout();
  } catch {}

  sockRef = null;
  status = "disconnected";
}

// ====================== EXPORT ====================== //
module.exports = {
  start,
  getStatus,
  getLastQr,

  // expose fungsi DB backup
  triggerRestoreFromDb: restoreAuthFromDb,
  triggerSaveAuthToDb: saveAuthToDb,

  // fungsi kirim WA
  send: sendToWA,

  logout,
};
