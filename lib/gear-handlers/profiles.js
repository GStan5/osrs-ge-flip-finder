const { requireAuth, isProUser } = require("../auth.js");
const {
  countOsrsProfiles,
  listOsrsProfiles,
  upsertOsrsProfile,
  deleteOsrsProfile,
} = require("../db.js");
const { fetchHiscores } = require("../hiscores.js");

const FREE_PROFILE_LIMIT = 1;

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const pro = isProUser(user);

  if (req.method === "GET") {
    try {
      const profiles = await listOsrsProfiles(user.id);
      res.status(200).json({ ok: true, pro, profiles, limit: pro ? null : FREE_PROFILE_LIMIT });
    } catch (err) {
      console.error("gear profiles GET:", err);
      res.status(500).json({ error: "Could not load profiles" });
    }
    return;
  }

  if (req.method === "POST") {
    const { username, refresh, isPrimary } = req.body || {};
    const name = String(username || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!name || name.length > 12) {
      res.status(400).json({ error: "Valid OSRS username required" });
      return;
    }

    try {
      if (!pro) {
        const existing = await listOsrsProfiles(user.id);
        const found = existing.find((p) => p.username.toLowerCase() === name.toLowerCase());
        if (!found) {
          const count = await countOsrsProfiles(user.id);
          if (count >= FREE_PROFILE_LIMIT) {
            res.status(403).json({ error: "Username limit reached", upgrade: "/upgrade" });
            return;
          }
        }
      }

      let combatStats = null;
      if (refresh !== false) {
        combatStats = await fetchHiscores(name);
        if (!combatStats) {
          res.status(404).json({ error: "Player not found on hiscores" });
          return;
        }
      }

      const profile = await upsertOsrsProfile(user.id, {
        username: name,
        combatStats,
        statsFetchedAt: combatStats ? new Date().toISOString() : null,
        isPrimary: Boolean(isPrimary),
      });
      res.status(200).json({ ok: true, profile });
    } catch (err) {
      console.error("gear profiles POST:", err);
      res.status(500).json({ error: "Could not save profile" });
    }
    return;
  }

  if (req.method === "DELETE") {
    const id = Number(req.query?.id);
    if (!id) {
      res.status(400).json({ error: "Profile id required" });
      return;
    }
    try {
      await deleteOsrsProfile(user.id, id);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Could not delete profile" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
