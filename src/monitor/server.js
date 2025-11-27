// src/monitor/server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const config = require("../../config");

const waSvc = require("../services/wa");
const discordSvc = require("../services/discord");

const app = express();
const PORT = process.env.MONITOR_PORT || 4000;

/* ----------------------- MIDDLEWARE ------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigin = process.env.MONITOR_ORIGIN || null;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin }));
} else {
  app.use(cors());
}

// Static assets
app.use("/monitor/public", express.static(path.join(__dirname, "public")));

// Views
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/* ------------------ TOKEN HELPER --------------------- */
function checkToken(req) {
  if (!config.PANEL_API_TOKEN) return false;

  const token =
    req.headers["x-api-token"] ||
    req.query.token ||
    req.body.token;

  return token === config.PANEL_API_TOKEN;
}

/* ------------------------- ROUTES --------------------------- */

// Panel Page
app.get("/panel", (req, res) => {
  if (config.PANEL_API_TOKEN && !checkToken(req)) {
    return res.status(401).send("Unauthorized");
  }
  res.render("panel", {
    apiTokenHeader: !!config.PANEL_API_TOKEN
  });
});

// API: STATUS
app.get("/api/status", (req, res) => {
  if (config.PANEL_API_TOKEN && !checkToken(req))
    return res.status(401).json({ error: "unauthorized" });

  res.json({
    whatsapp: waSvc.getStatus(),
    discord: discordSvc.getStatus()
  });
});

// API: WHATSAPP QR
app.get("/api/wa/qr", (req, res) => {
  if (config.PANEL_API_TOKEN && !checkToken(req))
    return res.status(401).json({ error: "unauthorized" });

  res.json({ qr: waSvc.getLastQr() || null });
});

// API: LOGOUT WA
app.post("/api/wa/logout", async (req, res) => {
  if (!checkToken(req))
    return res.status(401).json({ error: "unauthorized" });

  try {
    await waSvc.logout();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// API: RESTORE WA SESSION FROM DB
app.post("/api/wa/restore", async (req, res) => {
  if (!checkToken(req))
    return res.status(401).json({ error: "unauthorized" });

  try {
    const success = await waSvc.triggerRestoreFromDb();
    res.json({ ok: !!success });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// API: DISCORD RESTART
app.post("/api/discord/restart", async (req, res) => {
  if (!checkToken(req))
    return res.status(401).json({ error: "unauthorized" });

  try {
    await discordSvc.stop();
    await discordSvc.start();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ----------------------- BOOTSTRAP ------------------------- */

(async () => {
  // Start WA (if possible)
  try {
    await waSvc.start();
  } catch (err) {
    console.warn("Monitor: WA start failed", err?.message || err);
  }

  // Start Discord (if possible)
  try {
    await discordSvc.start();
  } catch (err) {
    console.warn("Monitor: Discord start failed", err?.message || err);
  }

  app.listen(PORT, () => {
    console.log(`Monitor panel running at http://0.0.0.0:${PORT}/panel`);
  });
})();
