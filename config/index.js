// config/index.js
require('dotenv').config();

const parseChannelMap = (raw) => {
  if (!raw) return {};
  return Object.fromEntries(
    raw.split(",")
       .map(s => s.trim())
       .filter(Boolean)
       .map(entry => {
         const idx = entry.indexOf(":");
         if (idx === -1) return null;
         const id = entry.slice(0, idx).trim();
         const name = entry.slice(idx + 1).trim();
         if (!id || !name) return null;
         return [id, name];
       })
       .filter(Boolean)
  );
};

module.exports = {
  ADMINS: process.env.ADMINS
    ? process.env.ADMINS.split(",").map(s => s.trim()).filter(Boolean)
    : [],
  TARGET_GROUP_ID: (process.env.TARGET_GROUP_ID || "").trim(),
  DISCORD_TOKEN: (process.env.DISCORD_TOKEN || "").trim(),
  CHANNEL_MAP: parseChannelMap(process.env.CHANNEL_MAP),
  MYSQL_URI: process.env.MYSQL_URI || "",
  FUN_REPLY: process.env.FUN_REPLY || "Hehe, saya bot lucu 😜"
};

