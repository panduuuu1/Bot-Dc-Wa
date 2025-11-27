// src/services/discord.js
const config = require("../../config");
const { createDiscordInstance } = require("../discord");

let client = null;
let status = "stopped"; // stopped | connecting | online | offline | error

function getStatus() {
  return status;
}

async function start() {
  if (client) return client;

  status = "connecting";
  client = createDiscordInstance();

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

  try {
      await client.login(config.DISCORD_TOKEN);
      return client;
  } catch (err) {
      console.error("Discord login failed:", err?.message || err);
      status = "error";
      client = null;
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
