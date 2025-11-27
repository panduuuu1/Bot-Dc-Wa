// src/monitor/server.js
const express = require("express");
const path = require("path");
const config = require("../../config");
const app = express();
const PORT = process.env.MONITOR_PORT || 4000;

// services (shim). These should export start/stop/getStatus/getLastQr/logout/triggerRestoreFromDb
const waSvc = require("../services/wa");
const discordSvc = require("../services/discord");

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS: allow only configured origin if provided (safer)
const cors = require("cors");
const allowedOrigin = process.env.MONITOR_ORIGIN || null;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin }));
} else {
  app.use(cors()); // fallback: open (but not recommended for production)
}

// static (public)
app.use("/monitor/public", express.static(path.join(__dirname, "public")));

// views
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// helper: check api token header / query
function checkToken(req) {
  if (!config.PANEL_API_TOKEN) return false;
  const token = req.headers["x-api-token"] || req.query.token || req.body.token;
  return token === config.PANEL_API_TOKEN;
}

// Panel home: require token if PANEL_API_TOKEN is set
app.get("/panel", (req, res) => {
  if (config.PANEL_API_TOKEN && !checkToken(req)) {
    return res.status(401).send("Unauthorized");
  }
  res.render("panel", {
    apiTokenHeader: !!config.PANEL_API_TOKEN
  });
});

// API: status
app.get("/api/status", (req, res) => {
  if (config.PANEL_API_TOKEN && !checkToken(req)) return res.status(401).json({ error: "unauthorized" });
  res.json({
    whatsapp: waSvc.getStatus(),
    discord: discordSvc.getStatus()
  });
});

// API: get latest QR (if any)
app.get("/api/wa/qr", (req, res) => {
  if (config.PANEL_API_TOKEN && !checkToken(req)) return res.status(401).json({ error: "unauthorized" });
  const qr = waSvc.getLastQr();
  res.json({ qr: qr || null });
});

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

// Start monitor but do not forcibly start services if global event bus exists
(async () => {
  // Try to start services (best-effort). Services should be idempotent.
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
