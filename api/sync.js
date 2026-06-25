const { requireAuth } = require("../lib/auth.js");
const { getUserSyncData, upsertUserSyncData } = require("../lib/db.js");

const ALLOWED_KEYS = new Set([
  "osrs-ge-flip-favorites-v1",
  "osrs-ge-flip-recipe-favorites-v1",
  "graardor_flip_log_v1",
  "graardor_presets_v1",
]);

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const user = await requireAuth(req, res);
    if (!user) return;
    try {
      const data = await getUserSyncData(user.id);
      res.status(200).json({ ok: true, sync: data });
    } catch (err) {
      console.error("sync GET error:", err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "PUT") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { key, data } = req.body || {};
    if (!key || !ALLOWED_KEYS.has(key)) {
      res.status(400).json({ error: "Invalid sync key" });
      return;
    }
    try {
      await upsertUserSyncData(user.id, key, data);
      res.status(200).json({ ok: true, key });
    } catch (err) {
      console.error("sync PUT error:", err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
