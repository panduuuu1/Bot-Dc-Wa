// src/whatsapp/queue.js
const { default: PQueue } = require("p-queue");
const { v4: uuidv4 } = require("uuid");

const waQueue = new PQueue({
    interval: 1000,   // 1 detik
    intervalCap: 4    // maksimal 4 pesan per interval
});

// Database queue dalam memory
let QUEUE = [];

// Tambah ke antrian
function addTask(to, text, sendFunction) {
    const id = uuidv4();

    const queueItem = {
        id,
        jid: to,
        text,
        status: "queued",
        createdAt: Date.now(),
        doneAt: null,
        error: null
    };

    QUEUE.push(queueItem);

    waQueue.add(async () => {
        const item = QUEUE.find(q => q.id === id);
        if (!item) return;

        item.status = "processing";

        try {
            await sendFunction(to, text);
            item.status = "success";
            item.doneAt = Date.now();
        } catch (err) {
            item.status = "failed";
            item.doneAt = Date.now();
            item.error = err.message || err.toString();
        }
    });

    return id;
}

// Dapatkan seluruh antrean
function listQueue() {
    return QUEUE;
}

// Dapatkan jumlah antrean
function getQueueCount() {
    return QUEUE.length;
}

// Dapatkan seluruh antrean (copy)
function getQueueItems() {
    return [...QUEUE];
}

module.exports = {
    addTask,
    listQueue,
    getQueueCount,
    getQueueItems
};
