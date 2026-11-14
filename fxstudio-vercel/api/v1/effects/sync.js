const { applyCors, extractToken } = require("../../_lib/cors");
const { getTokenRecord, saveTokenRecord, getEffectsBucket } = require("../../_lib/store");

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Use GET /api/v1/effects/sync" });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(400).json({ ok: false, error: "Missing token." });
  }

  const record = await getTokenRecord(token);
  if (!record) {
    return res.status(401).json({ ok: false, error: "Invalid token." });
  }

  const sinceVersion = Number(req.query?.sinceVersion ?? 0) || 0;
  const bucket = await getEffectsBucket(token);

  const upserts = Object.values(bucket.effects || {}).filter(
    (effect) => Number(effect.version || 0) > sinceVersion
  );

  const deleted = (bucket.deletedLog || [])
    .filter((entry) => Number(entry.version || 0) > sinceVersion)
    .map((entry) => entry.id);

  record.lastSyncAt = new Date().toISOString();
  await saveTokenRecord(record);

  return res.status(200).json({
    ok: true,
    token,
    latestVersion: bucket.latestVersion || 0,
    sinceVersion,
    upserts,
    deleted
  });
};
