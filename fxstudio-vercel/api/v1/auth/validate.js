const { applyCors, extractToken } = require("../../_lib/cors");
const { getTokenRecord, saveTokenRecord } = require("../../_lib/store");

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, error: "Use POST /api/v1/auth/validate" });
  }

  const body = req.body || {};
  const token = extractToken(req);
  const playerId = body.playerId ? String(body.playerId).trim() : "";
  const playerName = body.playerName ? String(body.playerName).trim() : "BedrockPlayer";

  if (!token) {
    return res.status(400).json({ valid: false, error: "Missing token." });
  }

  const record = await getTokenRecord(token);
  if (!record) {
    return res.status(401).json({ valid: false, error: "Invalid or unknown FXStudio token." });
  }

  if (record.playerId && playerId && record.playerId !== playerId) {
    return res.status(403).json({
      valid: false,
      error: "Token is already bound to another playerId.",
      boundPlayerName: record.playerName
    });
  }

  if (playerId) {
    record.playerId = playerId;
    record.playerName = playerName;
  }
  record.lastSyncAt = new Date().toISOString();
  await saveTokenRecord(record);

  return res.status(200).json({
    valid: true,
    token: record.token,
    playerId: record.playerId,
    playerName: record.playerName,
    serverTime: record.lastSyncAt
  });
};
