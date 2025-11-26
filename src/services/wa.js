let waStatus = "disconnected";

function getWaStatus() {
    return waStatus;
}

client.on('qr', () => {
    waStatus = "qr";
});

client.on('ready', () => {
    waStatus = "connected";
});

client.on('disconnected', () => {
    waStatus = "disconnected";
});

module.exports = {
    startWhatsapp,
    getWaStatus
};
