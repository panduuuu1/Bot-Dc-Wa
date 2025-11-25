// index.js
require("dotenv").config();
const config = require("../config");
const { startWA, sendToWA } = require("./whatsapp");
const startDiscord = require("./discord");

let discordClient = null;

(async () => {
    console.log("🚀 Starting WA...");

    await startWA(async (sock, msg) => {
        try {
            // =============== LOG PESAN MASUK ===============
            console.log("📩 NEW MESSAGE");
            console.log("RAW JID:", msg.key.remoteJid);
            console.log("RAW PARTICIPANT:", msg.key.participant);
            console.log("ADMINS in ENV:", config.ADMINS);

            const jid = msg.key.remoteJid;
            const sender = msg.key.participant || jid;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                "";

            console.log("TEXT:", text);
            console.log("SENDER:", sender);

            // normalize admin compare (digits only)
            const normalizedAdmins = config.ADMINS.map(a => (a || "").toString().replace(/\D/g, ""));
            const normalizedSender = (sender || "")
            .toString()
            .replace(/@.*$/, '')   // hilangkan domain
            .replace(/\D/g, '');   // ambil angka saja

            console.log("normalizedAdmins:", normalizedAdmins);
            console.log("normalizedSender:", normalizedSender);

            const isAdmin = normalizedAdmins.includes(normalizedSender);

            console.log("isAdmin:", isAdmin);

            // quoted reply detection
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            const quotedFromMe = quotedParticipant === sock.user?.id;

            if (quoted && quotedFromMe) {
                console.log("📝 QUOTED REPLY TRIGGER");
                if (config.TARGET_GROUP_ID) await sendToWA(config.TARGET_GROUP_ID, config.FUN_REPLY);
                return;
            }

            // =================== PING COMMAND ===================
            if (text === "!ping") {
                console.log("⚡ !ping RECEIVED");
                if (!isAdmin) {
                    console.log("❌ !ping IGNORED (Not admin)");
                    return;
                }
                console.log("✅ !ping ACCEPTED (Admin)");
                return sendToWA(jid, "🏓 Pong! Bot aktif.");
            }

            // =================== SD COMMAND ===================
            if (text === "!sd" && isAdmin) {
                console.log("⚡ !sd RECEIVED");
                await sendToWA(jid, "🔌 Bot dimatikan dengan aman...");
                try { await sock.logout(); } catch(e){}
                try { if (discordClient) await discordClient.destroy(); } catch(e){}
                process.exit(0);
            }

            // ===================== RESTART ======================
            if (text === "!restart" && isAdmin) {
                console.log("⚡ !restart RECEIVED");
                await sendToWA(jid, "♻ Restart...");
                process.exit(1);
            }

            // ===================== LIST GROUP =====================
            if (text === "!listgroup") {
                console.log("⚡ !listgroup RECEIVED");
                const chats = Object.values(sock.chats || {});
                const groups = chats.filter(c => c.id?.endsWith?.("@g.us"));
                let reply = "📜 Daftar Grup:\n\n";
                for (const g of groups) {
                    reply += `• ${g?.subject || "Unknown"} → ${g.id}\n`;
                }
                return sendToWA(jid, reply);
            }

        } catch (err) {
            console.error("Error WA handler:", err);
        }

    }, async (sock) => {
        console.log("✅ WA Ready callback");

        if (config.TARGET_GROUP_ID) {
            try {
                await sendToWA(config.TARGET_GROUP_ID, "💬 Semua diam, saya sudah ready 😏");
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
        try { if (discordClient) await discordClient.destroy(); } catch(e){}
        try { process.exit(0); } catch(e){ process.exit(0); }
    });

})();



