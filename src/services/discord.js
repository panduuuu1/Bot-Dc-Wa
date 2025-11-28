// src/services/discord.js
const config = require("../../config");
const { createDiscordInstance } = require("../discord");

let client = null;
let status = "stopped"; 
// status = stopped | connecting | online | offline | error

function getStatus() {
    return status;
}

async function start() {
    if (client) return client;

    status = "connecting";
    client = createDiscordInstance();

    /* ====== STATUS TRACKING ====== */
    client.on("ready", () => {
        status = "online";
        console.log("⚡ [Discord] Ready as", client.user?.tag);
    });

    client.on("error", (err) => {
        status = "error";
        console.error("❌ [Discord] Error:", err);
    });

    client.on("disconnect", () => {
        status = "offline";
        console.warn("🔌 [Discord] Disconnected");
    });

    /* ====== LOGIN HANDLING ====== */
    try {
        await client.login(config.DISCORD_TOKEN);
        return client;
    } catch (err) {
        console.error("❌ Discord login failed:", err.message || err);
        status = "error";
        client = null;
        throw err;
    }
}

async function stop() {
    if (!client) return;

    try {
        await client.destroy();
    } catch (_) {}

    client = null;
    status = "stopped";
}

module.exports = { 
    start, 
    stop, 
    getStatus 
};
