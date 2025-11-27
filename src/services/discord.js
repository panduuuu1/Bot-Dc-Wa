// src/services/discord.js
const { Client, GatewayIntentBits } = require("discord.js");
const config = require("../../config");

let client = null;
let status = "stopped";

function getStatus() {
  return status;
}

async function start() {
  if (client) return client;

  status = "connecting";

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  client.on("ready", () => {
    status = "online";
    console.log("Discord ready:", client.user.tag);
  });

  client.on("error", () => status = "error");
  client.on("disconnect", () => status = "offline");
  client.on("shardDisconnect", () => status = "offline");

  try {
    await client.login(config.DISCORD_TOKEN);
    return client;
  } catch (err) {
    console.error("Discord login error:", err.message);
    status = "error";
    throw err;
  }
}

async function stop() {
  if (!client) return;
  try { await client.destroy(); } catch {}
  client = null;
  status = "stopped";
}

module.exports = { start, stop, getStatus };
