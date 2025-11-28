// src/services/logs.js
const EventEmitter = require("events");

class Logs extends EventEmitter {
  constructor(limit = 1000) {
    super();
    this.limit = limit;
    this.buf = [];
  }

  push(entry) {
    const item = {
      ts: Date.now(),
      id: (Math.random().toString(36).slice(2,9)),
      ...entry
    };
    this.buf.push(item);
    if (this.buf.length > this.limit) this.buf.splice(0, this.buf.length - this.limit);
    this.emit("log", item);
    return item;
  }

  recent(n = 200) {
    if (!n) return [...this.buf];
    return this.buf.slice(Math.max(0, this.buf.length - n));
  }

  clear() {
    this.buf = [];
    this.emit("log", { type: "system", msg: "logs cleared", ts: Date.now() });
  }
}

module.exports = new Logs();
