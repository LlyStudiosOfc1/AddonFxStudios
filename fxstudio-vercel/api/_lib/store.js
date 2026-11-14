// Unified storage adapter for FXStudio on Vercel
// Supports Upstash Redis / Vercel KV via native REST fetch when env vars are set,
// with automatic warm-memory fallback for zero-config testing.

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

if (!global.__FXSTUDIO_MEM__) {
  global.__FXSTUDIO_MEM__ = {
    tokens: {},
    effectsByToken: {}
  };
}

const mem = global.__FXSTUDIO_MEM__;

async function kvCommand(args) {
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });
  if (!response.ok) {
    throw new Error(`KV error: ${response.status}`);
  }
  const data = await response.json();
  return data.result;
}

function getStorageMode() {
  return HAS_KV ? "vercel-kv" : "memory";
}

function normalizeTokenCode(raw) {
  return String(raw || "").trim().toUpperCase();
}

function generateTokenCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `FX-${block()}-${block()}`;
}

async function getTokenRecord(token) {
  const key = normalizeTokenCode(token);
  if (!key) return null;

  if (HAS_KV) {
    const raw = await kvCommand(["GET", `fx:token:${key}`]);
    return raw ? JSON.parse(raw) : null;
  }
  return mem.tokens[key] || null;
}

async function saveTokenRecord(record) {
  const key = normalizeTokenCode(record.token);
  record.token = key;

  if (HAS_KV) {
    await kvCommand(["SET", `fx:token:${key}`, JSON.stringify(record)]);
  } else {
    mem.tokens[key] = record;
  }
  return record;
}

async function ensureTokenRecord(token, label = "Studio Session") {
  const key = normalizeTokenCode(token);
  let existing = await getTokenRecord(key);
  if (!existing) {
    existing = {
      token: key,
      label,
      playerId: null,
      playerName: null,
      createdAt: new Date().toISOString(),
      lastSyncAt: null
    };
    await saveTokenRecord(existing);
  }
  return existing;
}

async function getEffectsBucket(token) {
  const key = normalizeTokenCode(token);
  if (HAS_KV) {
    const raw = await kvCommand(["GET", `fx:bucket:${key}`]);
    if (raw) return JSON.parse(raw);
  } else if (mem.effectsByToken[key]) {
    return mem.effectsByToken[key];
  }

  return {
    latestVersion: 0,
    effects: {},
    deletedLog: [] // [{ id, version }]
  };
}

async function saveEffectsBucket(token, bucket) {
  const key = normalizeTokenCode(token);
  if (HAS_KV) {
    await kvCommand(["SET", `fx:bucket:${key}`, JSON.stringify(bucket)]);
  } else {
    mem.effectsByToken[key] = bucket;
  }
  return bucket;
}

async function upsertEffect(token, payload) {
  const key = normalizeTokenCode(token);
  await ensureTokenRecord(key);
  const bucket = await getEffectsBucket(key);

  const nextVersion = (bucket.latestVersion || 0) + 1;
  const now = new Date().toISOString();
  const id =
    payload.id && String(payload.id).trim()
      ? String(payload.id).trim()
      : `eff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const existing = bucket.effects[id];

  const effect = {
    id,
    ownerToken: key,
    name: String(payload.name || "Untitled Effect").trim(),
    type: String(payload.type || "minecraft:basic_flame_particle").trim(),
    position: {
      x: Number(payload.position?.x ?? 0),
      y: Number(payload.position?.y ?? 1),
      z: Number(payload.position?.z ?? 0)
    },
    rotation: {
      x: Number(payload.rotation?.x ?? 0),
      y: Number(payload.rotation?.y ?? 0),
      z: Number(payload.rotation?.z ?? 0)
    },
    scale: Number(payload.scale ?? 1.0),
    molangVars:
      payload.molangVars && typeof payload.molangVars === "object"
        ? payload.molangVars
        : {},
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: nextVersion
  };

  bucket.latestVersion = nextVersion;
  bucket.effects[id] = effect;
  bucket.deletedLog = (bucket.deletedLog || []).filter((entry) => entry.id !== id);

  await saveEffectsBucket(key, bucket);
  return { effect, latestVersion: nextVersion };
}

async function deleteEffect(token, id) {
  const key = normalizeTokenCode(token);
  const bucket = await getEffectsBucket(key);
  const targetId = String(id || "").trim();

  if (!targetId || !bucket.effects[targetId]) {
    return { deleted: false, latestVersion: bucket.latestVersion || 0 };
  }

  const nextVersion = (bucket.latestVersion || 0) + 1;
  delete bucket.effects[targetId];
  bucket.latestVersion = nextVersion;
  bucket.deletedLog = [
    ...(bucket.deletedLog || []).filter((item) => item.id !== targetId),
    { id: targetId, version: nextVersion }
  ].slice(-200);

  await saveEffectsBucket(key, bucket);
  return { deleted: true, id: targetId, latestVersion: nextVersion };
}

module.exports = {
  getStorageMode,
  normalizeTokenCode,
  generateTokenCode,
  getTokenRecord,
  saveTokenRecord,
  ensureTokenRecord,
  getEffectsBucket,
  upsertEffect,
  deleteEffect
};
