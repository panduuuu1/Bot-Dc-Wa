// src/monitor/routes.js
const express = require("express");
const router = express.Router();

/**
 * req.app.locals akan di‑isi dari server.js
 * contoh:
 * app.locals.wa_status = "connected";
 * app.locals.discord_status = "connected";
 * app.locals.qr = "base64_qr";
 */

// PANEL UTAMA
router.get("/", (req, res) => {
    res.render("panel", {
        wa_status: req.app.locals.wa_status || "unknown",
        discord_status: req.app.locals.discord_status || "unknown",
        uptime: req.app.locals.uptime || 0,
        queue_size: req.app.locals.queue_size || 0,
    });
});

// QR PAGE
router.get("/qr", (req, res) => {
    res.render("qr", {
        qr: req.app.locals.qr || null,
        wa_status: req.app.locals.wa_status || "unknown",
    });
});

module.exports = router;
