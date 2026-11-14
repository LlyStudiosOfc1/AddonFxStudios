const { applyCors, extractToken } = require("../_lib/cors");
const {
  generateTokenCode,
  getTokenRecord,
  saveTokenRecord,
  ensureTokenRecord,
  upsertEffect,
  getStorageMode
} = require("../_lib/store");

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method === "GET") {
    const token = extractToken(req);
    if (!token) {
      return res.status(400).json({ ok: false, error: "Token parameter is required." });
    }
    const record = await getTokenRecord(token);
    if (!record) {
      return res.status(404).json({ ok: false, error: "Token not found." });
    }
    return res.status(200).json({ ok: true, storage: getStorageMode(), tokenData: record });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const requestedToken = body.token ? String(body.token).trim().toUpperCase() : "";
    const label = String(body.label || "Bedrock Creator").trim();

    if (requestedToken) {
      const record = await ensureTokenRecord(requestedToken, label);
      return res.status(200).json({ ok: true, storage: getStorageMode(), tokenData: record });
    }

    const token = generateTokenCode();
    const record = await saveTokenRecord({
      token,
      label,
      playerId: null,
      playerName: null,
      createdAt: new Date().toISOString(),
      lastSyncAt: null
    });

    // Seed starter particle preset so first sync in-game works immediately
    await upsertEffect(token, {
      name: "Arcane Core Flame",
      type: "minecraft:soul_particle",
      position: { x: 0, y: 1.2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1.0,
      molangVars: {
        "variable.color_r": 0.25,
        "variable.color_g": 0.85,
        "variable.color_b": 1.0,
        "variable.speed": 1.0
      }
    });

    return res.status(201).json({ ok: true, storage: getStorageMode(), tokenData: record });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
};
