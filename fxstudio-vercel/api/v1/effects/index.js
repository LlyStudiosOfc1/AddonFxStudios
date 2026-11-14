const { applyCors, extractToken } = require("../../_lib/cors");
const {
  ensureTokenRecord,
  getEffectsBucket,
  upsertEffect,
  deleteEffect
} = require("../../_lib/store");

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  const token = extractToken(req);
  if (!token) {
    return res.status(400).json({ ok: false, error: "Missing token." });
  }

  if (req.method === "GET") {
    await ensureTokenRecord(token);
    const bucket = await getEffectsBucket(token);
    const effects = Object.values(bucket.effects || {}).sort((a, b) => b.version - a.version);
    return res.status(200).json({
      ok: true,
      token,
      latestVersion: bucket.latestVersion || 0,
      effects
    });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const body = req.body || {};
    const { effect, latestVersion } = await upsertEffect(token, body);
    return res.status(200).json({
      ok: true,
      latestVersion,
      effect
    });
  }

  if (req.method === "DELETE") {
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: "Effect id is required for deletion." });
    }
    const result = await deleteEffect(token, id);
    return res.status(200).json({ ok: true, ...result });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
};
