const { default: PQueue } = require("p-queue");
const { v4: uuidv4 } = require("uuid");

const waQueue = new PQueue({
    interval: 1000,
    intervalCap: 4
});

// Database queue dalam memory
let QUEUE = [];

// Tambah ke antrian
function addTask(to, text, sendFunction) {
    const id = uuidv4();

    QUEUE.push({
        id,
        to,
        text,
        status: "queued",
        createdAt: Date.now(),
        doneAt: null,
        error: null
    });

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
            item.error = err.message;
        }
    });

    return id;
}

// Dapatkan seluruh antrean
function listQueue() {
    return QUEUE;
}

module.exports = {
    addTask,
    listQueue
};
