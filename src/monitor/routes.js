// src/monitor/routes.js

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.render("panel");
});

router.get("/qr", (req, res) => {
    res.render("qr");
});

module.exports = router;

