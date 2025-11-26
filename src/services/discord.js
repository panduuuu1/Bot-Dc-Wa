// src/services/discord.js
const { Client, GatewayIntentBits } = require("discord.js");
const config = require("../../config");

let client = null;
let status = "stopped"; // stopped | connecting | online | offline | error

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
    console.log("Discord client ready:", client.user?.tag);
  });

  client.on("error", (err) => {
    console.error("Discord error:", err);
    status = "error";
  });

  client.on("disconnect", () => {
    status = "offline";
  });

  client.on("shardDisconnect", () => {
    status = "offline";
  });

  try {
    await client.login(config.DISCORD_TOKEN);
    return client;
  } catch (err) {
    console.error("Discord login failed:", err?.message || err);
    status = "error";
    throw err;
  }
}

async function stop() {
  if (!client) return;
  try {
    await client.destroy();
  } catch (e) { /* ignore */ }
  client = null;
  status = "stopped";
}

module.exports = { start, stop, getStatus };
