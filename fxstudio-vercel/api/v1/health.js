const { applyCors } = require("../_lib/cors");
const { getStorageMode } = require("../_lib/store");

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  res.status(200).json({
    ok: true,
    service: "FXStudio API",
    storage: getStorageMode(),
    timestamp: new Date().toISOString()
  });
};
