// src/monitor/server.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("../../config");

// services
const waSvc = require("../services/wa");
const discordSvc = require("../services/discord");

const app = express();
const PORT = process.env.MONITOR_PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// static (public) — you can create src/monitor/public for assets
app.use("/monitor/public", express.static(path.join(__dirname, "public")));

// views
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Panel home
app.get("/panel", (req, res) => {
  res.render("panel", {
    apiTokenHeader: process.env.PANEL_API_TOKEN ? true : false
  });
});

// API: status
app.get("/api/status", (req, res) => {
  res.json({
    whatsapp: waSvc.getStatus(),
    discord: discordSvc.getStatus()
  });
});

// API: get latest QR (if any)
app.get("/api/wa/qr", (req, res) => {
  const qr = waSvc.getLastQr();
  res.json({ qr: qr || null });
});

// helper: check api token header
function checkToken(req) {
  if (!process.env.PANEL_API_TOKEN) return false;
  const token = req.headers["x-api-token"] || req.query.token;
  return token === process.env.PANEL_API_TOKEN;
}

// POST: logout WA
app.post("/api/wa/logout", async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    await waSvc.logout();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST: restore auth from DB (attempt)
app.post("/api/wa/restore", async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const ok = await waSvc.triggerRestoreFromDb();
    res.json({ ok: !!ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST: restart discord
app.post("/api/discord/restart", async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    await discordSvc.stop();
    await discordSvc.start();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// start both services if they aren't started (best-effort)
(async () => {
  try {
    await waSvc.start();
  } catch (e) {
    console.warn("Monitor: WA start failed (monitor will still run)", e?.message || e);
  }
  try {
    await discordSvc.start();
  } catch (e) {
    console.warn("Monitor: Discord start failed (monitor will still run)", e?.message || e);
  }

  app.listen(PORT, () => {
    console.log(`Monitor panel running at http://0.0.0.0:${PORT}/panel`);
  });
})();
