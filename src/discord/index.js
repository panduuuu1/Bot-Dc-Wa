const { Client, GatewayIntentBits } = require("discord.js");
const config = require("../../config");
const { sendToWA } = require("../whatsapp");

function createDiscordInstance() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ]
    });

    client.on("ready", () => {
        console.log("✅ Discord ready:", client.user?.tag);
    });

    client.on("messageCreate", async (msg) => {
        try {
            if (!config.CHANNEL_MAP[msg.channel.id]) return;

            let content = msg.content;

            if (!content && msg.embeds.length > 0) {
                const embed = msg.embeds[0];
                let parts = [];
                if (embed.title) parts.push(`🛎 *${embed.title}*`);
                if (embed.description) parts.push(embed.description);
                if (embed.fields?.length > 0) {
                    parts.push("──────────────");
                    embed.fields.forEach(f => {
                        parts.push(`*${f.name}*\n${f.value}`);
                    });
                }
                if (embed.footer?.text) {
                    parts.push("──────────────\n_" + embed.footer.text + "_");
                }
                content = parts.join("\n\n");
            }

            if (content && config.TARGET_GROUP_ID) {
                const gardenName = config.CHANNEL_MAP[msg.channel.id];
                const finalText =
`🌱 ${gardenName} Update
──────────────
${content}
──────────────`;

                await sendToWA(config.TARGET_GROUP_ID, finalText);
            }
        } catch (e) {
            console.error("❌ Discord forward error:", e);
        }
    });

    return client;
}

module.exports = { createDiscordInstance };
