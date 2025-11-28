// src/monitor/routes.js
const express = require("express");
const router = express.Router();
const state = require("./state");
const config = require("../../config");

// Token middleware
function checkToken(req, res, next) {
  const token = req.headers["x-api-token"];
  if (!token || token !== config.PANEL_API_TOKEN) {
    return res.status(401).json({ error: "Invalid or missing API token" });
  }
  next();
}

// ---------------- STATUS ----------------
router.get("/status", (req, res) => {
  res.json({
    whatsapp: state.waStatus,
    discord: state.dcStatus,
    uptime: state.uptime,
    device: state.waDevice
  });
});

// ---------------- QR ----------------
router.get("/wa/qr", (req, res) => {
  res.json({ qr: state.waQr });
});

// ---------------- LOGS ----------------
router.get("/logs", (req, res) => {
  res.json({ logs: state.logs });
});

// ---------------- SSE REALTIME LOG STREAM ----------------
router.get("/stream/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const intv = setInterval(() => {
    res.write(`data: ${JSON.stringify(state.logs)}\n\n`);
  }, 1500);

  req.on("close", () => clearInterval(intv));
});

// ---------------- PROTECTED ACTIONS ----------------
router.post("/wa/logout", checkToken, async (req, res) => {
  try {
    const wa = require("../services/wa");
    await wa.logout();
    state.addLog("WA logout executed.");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/wa/restore", checkToken, async (req, res) => {
  try {
    const wa = require("../services/wa");
    await wa.restoreAuth();
    state.addLog("WA restore executed.");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/discord/restart", checkToken, async (req, res) => {
  try {
    const dc = require("../services/discord");
    await dc.restart();
    state.addLog("Discord restart executed.");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
