// src/monitor/server.js
const express = require("express");
const path = require("path");
const router = require("./routes");

function startMonitorServer() {
  const app = express();
  const PORT = process.env.PANEL_PORT || 4000;

  app.use(express.json());
  app.use("/api", router);

  // serve panel
  app.use("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "panel.html"));
  });

  app.listen(PORT, () => {
    console.log(`🌍 Monitor Panel running at http://localhost:${PORT}`);
  });
}

module.exports = { startMonitorServer };
