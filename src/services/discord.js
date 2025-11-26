let discordStatus = "offline";

client.on('ready', () => {
    discordStatus = "online";
});

client.on('error', () => {
    discordStatus = "error";
});

client.on('disconnect', () => {
    discordStatus = "offline";
});

function getDiscordStatus() {
    return discordStatus;
}

module.exports = {
    startDiscord,
    getDiscordStatus
};
