// src/index.js
require("dotenv").config();
global.crypto = require("crypto");

const config = require("../config");

// CORE SERVICES
const waService = require("./services/wa");
const discordService = require("./services/discord");
const queue = require("./whatsapp/queue");

// MONITOR PANEL
const monitorPanel = require("./monitor/server");

// STATE
let discordClient = null;
let shuttingDown = false;

const COMMANDS = [
  { cmd: "!ping", desc: "Cek apakah bot aktif" },
  { cmd: "!status", desc: "Tampilkan status bot WA & Discord + WA queue" },
  { cmd: "!queue", desc: "Tampilkan isi WA queue" },
  { cmd: "!listgroup", desc: "Tampilkan daftar grup WA" },
  { cmd: "!sd", desc: "Matikan bot dengan aman" },
  { cmd: "!restart", desc: "Restart bot" },
  { cmd: "!help", desc: "Tampilkan daftar command" },
];

// ===============================================================
//                    START MAIN PROCESS
// ===============================================================

(async () => {
  console.log("🚀 Starting WhatsApp...");

  await waService.start(
    // -------------------------------------------------------------
    // ON MESSAGE HANDLER
    // -------------------------------------------------------------
    async (sock, msg) => {
      try {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;

        if (jid === "status@broadcast") return;
        if (!msg.message) return;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        const normalizedAdmins = config.ADMINS.map(a =>
          (a || "").toString().replace(/\D/g, "")
        );

        const normalizedSender = (sender || "").toString().replace(/\D/g, "");
        const isAdmin = normalizedAdmins.includes(normalizedSender);

        // Auto-reply for quoted messages from bot
        const quoted =
          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedFromMe =
          msg.message?.extendedTextMessage?.contextInfo?.participant ===
          sock.user?.id;

        if (quoted && quotedFromMe) {
          if (config.TARGET_GROUP_ID) {
            await waService.send(config.TARGET_GROUP_ID, config.FUN_REPLY);
          }
          return;
        }

        if (!isAdmin) return;

        // ========================== COMMANDS ==========================
        if (text === "!ping")
          return waService.send(jid, "🏓 Pong! Bot aktif.");

        if (text === "!status") {
          const statusMsg = `💡 Status Bot:
- WA: ${waService.getStatus()}
- Discord: ${discordService.getStatus()}
- WA Queue: ${queue.getQueueCount()} pesan`;
          return waService.send(jid, statusMsg);
        }

        if (text === "!queue") {
          const items = queue.listQueue();
          let reply = "📝 WA Queue:\n\n";
          if (items.length === 0) reply += "Kosong.";
          else {
            items.forEach((q, i) => {
              reply += `${i + 1}. To: ${q.jid} → ${q.text} [${q.status}]\n`;
            });
          }
          return waService.send(jid, reply);
        }

        if (text === "!listgroup") {
          const chats = Object.values(sock.chats || {});
          const groups = chats.filter(c => c.id?.endsWith?.("@g.us"));
          let reply = "📜 Daftar Grup:\n\n";

          for (const g of groups) {
            reply += `• ${g.subject || "Unknown"} → ${g.id}\n`;
          }

          return waService.send(jid, reply);
        }

        if (text === "!sd") {
          shuttingDown = true;
          await waService.send(jid, "Kenapa di-SD bos? 😡");

          let pending = queue
            .listQueue()
            .filter(q => q.status === "queued" || q.status === "processing");

          while (pending.length > 0) {
            console.log(
              `⏳ Menunggu ${pending.length} WA task selesai...`
            );
            await new Promise(r => setTimeout(r, 1000));
            pending = queue
              .listQueue()
              .filter(q => q.status === "queued" || q.status === "processing");
          }

          try {
            await discordService.stop();
          } catch {}

          console.log("🔌 Semua task selesai. Bot dimatikan.");
          process.exit(0);
        }

        if (text === "!restart") {
          await waService.send(jid, "♻ Restart...");
          process.exit(1);
        }

        if (text === "!help") {
          let helpMsg = "📋 Daftar Command Admin:\n\n";
          COMMANDS.forEach(c => (helpMsg += `${c.cmd} → ${c.desc}\n`));
          return waService.send(jid, helpMsg);
        }
      } catch (err) {
        console.error("Error WA handler:", err);
      }
    },

    // -------------------------------------------------------------
    // ON READY
    // -------------------------------------------------------------
    async sock => {
      console.log("✅ WA Ready callback");

      if (config.TARGET_GROUP_ID) {
        try {
          await waService.send(
            config.TARGET_GROUP_ID,
            "Ready Pa Bos 😏"
          );
        } catch (err) {
          console.error("Gagal kirim auto message:", err);
        }
      }

      console.log("🚀 Starting Discord...");
      discordClient = await discordService.start();

      console.log("🌐 Starting Monitor Panel...");
    await monitorPanel.start();
    }
  );

  // ==============================================================
  //             HANDLE CTRL+C (SIGINT)
  // ==============================================================
  process.on("SIGINT", async () => {
    console.log("🔌 Shutdown signal diterima (SIGINT)");
    try {
      await discordService.stop();
    } catch {}
    process.exit(0);
  });
})();
