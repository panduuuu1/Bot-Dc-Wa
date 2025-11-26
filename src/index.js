// src/index.js
require("dotenv").config();
const config = require("../config");
const { startWA, sendToWA } = require("./whatsapp");
const startDiscord = require("./discord");
const queue = require("./whatsapp/queue");
global.crypto = require("crypto");

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

(async () => {
    console.log("🚀 Starting WA...");

    await startWA(async (sock, msg) => {
        try {
            const jid = msg.key.remoteJid;
            const sender = msg.key.participant || jid;

            // ignore broadcast/status
            if (jid === "status@broadcast") return;

            // ignore messages that can't be decrypted
            if (!msg.message) return;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                "";

            // normalize admin compare (digits only)
            const normalizedAdmins = config.ADMINS.map(a => (a || "").toString().replace(/\D/g, ""));
            const normalizedSender = (sender || "").toString().replace(/\D/g, "");
            const isAdmin = normalizedAdmins.includes(normalizedSender);

            // log hanya admin
            if (isAdmin) {
                console.log(`TEXT: ${text}`);
                console.log(`SENDER: ${sender}`);
                console.log(`normalizedAdmins: ${JSON.stringify(normalizedAdmins)}`);
                console.log(`normalizedSender: ${normalizedSender}`);
                console.log(`isAdmin: ${isAdmin}`);
            }
            
            // quoted reply detection
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            const quotedFromMe = quotedParticipant === sock.user?.id;

            if (quoted && quotedFromMe) {
                if (config.TARGET_GROUP_ID) await sendToWA(config.TARGET_GROUP_ID, config.FUN_REPLY);
                return;
            }

            // hanya proses command admin
            if (!isAdmin) return;

            // COMMANDS
            if (text === "!ping") return sendToWA(jid, "🏓 Pong! Bot aktif.");

            if (text === "!status") {
                const queueCount = queue.listQueue().length;
                const statusMsg = `💡 Status Bot:
- WA: ${sock ? "Connected ✅" : "Disconnected ❌"}
- Discord: ${discordClient ? "Connected ✅" : "Disconnected ❌"}
- WA Queue: ${queueCount} pesan`;
                return sendToWA(jid, statusMsg);
            }

            if (text === "!queue") {
                const items = queue.listQueue();
                let reply = "📝 WA Queue:\n";
                if (items.length === 0) reply += "Kosong.";
                else items.forEach((q, idx) => {
                    reply += `${idx + 1}. To: ${q.to} → ${q.text} [${q.status}]\n`;
                });
                return sendToWA(jid, reply);
            }

            if (text === "!listgroup") {
                const chats = Object.values(sock.chats || {});
                const groups = chats.filter(c => c.id?.endsWith?.("@g.us"));
                let reply = "📜 Daftar Grup:\n\n";
                for (const g of groups) {
                    reply += `• ${g?.subject || "Unknown"} → ${g.id}\n`;
                }
                return sendToWA(jid, reply);
            }

            if (text === "!sd") {
                shuttingDown = true;

                try {
                    await sendToWA(jid, "Kenape Di Sd boss😡");
                } catch(e) {
                    console.error("Gagal kirim pesan sebelum shutdown:", e);
                }

                // tunggu WA queue selesai
                let pending = queue.listQueue().filter(q => q.status === "queued" || q.status === "processing");
                while (pending.length > 0) {
                    console.log(`⏳ Menunggu ${pending.length} task WA selesai...`);
                    await new Promise(r => setTimeout(r, 1000));
                    pending = queue.listQueue().filter(q => q.status === "queued" || q.status === "processing");
                }

                try { if (discordClient) await discordClient.destroy(); } catch(e){ console.error(e); }

                console.log("🔌 Semua task selesai. Bot dimatikan.");
                process.exit(0);
            }

            if (text === "!restart") {
                await sendToWA(jid, "♻ Restart...");
                process.exit(1); // pm2/process manager restart
            }

            if (text === "!help") {
                let helpMsg = "📋 Daftar Command Admin:\n\n";
                COMMANDS.forEach(c => {
                    helpMsg += `${c.cmd} → ${c.desc}\n`;
                });
                return sendToWA(jid, helpMsg);
            }

        } catch (err) {
            console.error("Error WA handler (admin only):", err);
        }
    }, async (sock) => {
        console.log("✅ WA Ready callback");
        if (config.TARGET_GROUP_ID) {
            try {
                await sendToWA(config.TARGET_GROUP_ID, "Ready Pa Bos 😏");
                console.log("✅ Auto message dikirim ke grup");
            } catch (err) {
                console.error("Gagal kirim auto message:", err?.message || err);
            }
        }

        console.log("🚀 Starting Discord...");
        discordClient = startDiscord();
    });

    process.on("SIGINT", async () => {
        console.log("🔌 Shutdown signal (SIGINT) received...");
        try { if (discordClient) await discordClient.destroy(); } catch(e){ }
        process.exit(0);
    });

})();


