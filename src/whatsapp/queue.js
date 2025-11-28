// src/whatsapp/queue.js
const { default: PQueue } = require("p-queue");
const { v4: uuidv4 } = require("uuid");

/**
 * WA message sending queue (global)
 *  - interval     : 1 second
 *  - intervalCap  : max 4 messages / second
 */
const waQueue = new PQueue({
    interval: 1000,
    intervalCap: 4
});

/** In-memory queue store */
let QUEUE = [];

/** Optional: Auto clean done tasks after X ms */
const AUTO_CLEAN_MS = 1000 * 60 * 30; // 30 menit

function cleanup() {
    const now = Date.now();
    QUEUE = QUEUE.filter(item => {
        if (!item.doneAt) return true;
        return now - item.doneAt < AUTO_CLEAN_MS;
    });
}

/**
 * Add task to WA send queue
 * @param {string} to - WA JID
 * @param {string} text - message content
 * @param {function} sendFunction - actual sender
 */
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
            item.error = err.message || String(err);
        }

        cleanup();
    });

    return id;
}

/** Returns full queue */
function listQueue() {
    return QUEUE;
}

/** Returns count */
function getQueueCount() {
    return QUEUE.length;
}

/** Returns queue clone (safe for panel) */
function getQueueItems() {
    return [...QUEUE];
}

/** Clear queue manually (for panel button) */
function clearQueue() {
    QUEUE = [];
    return true;
}

module.exports = {
    addTask,
    listQueue,
    getQueueCount,
    getQueueItems,
    clearQueue
};

