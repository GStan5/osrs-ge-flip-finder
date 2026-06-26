const crypto = require("crypto");
const { getAuthedUser, isProUser } = require("../auth.js");
const {
  countGearPresets,
  listGearPresets,
  getGearPresetByShareId,
  createGearPreset,
  updateGearPreset,
  deleteGearPreset,
} = require("../db.js");

const FREE_PRESET_LIMIT = 1;

function genShareId() {
  return crypto.randomBytes(8).toString("base64url");
}

function bodyId(req) {
  return req.query?.id || req.body?.id;
}

module.exports = async function handler(req, res) {
  const share = req.query?.share;

  if (req.method === "GET" && share) {
    try {
      const preset = await getGearPresetByShareId(String(share));
      if (!preset) {
        res.status(404).json({ error: "Preset not found" });
        return;
      }
      if (!preset.is_public) {
        const user = await getAuthedUser(req);
        if (!user || user.id !== preset.user_id) {
          res.status(403).json({ error: "This preset is private" });
          return;
        }
      }
      res.status(200).json({
        ok: true,
        preset: {
          shareId: preset.share_id,
          name: preset.name,
          goal: preset.goal,
          monsterId: preset.monster_id,
          slots: preset.slots,
          prayers: preset.prayers,
          combatStyle: preset.combat_style,
          isPublic: preset.is_public,
          ironman: preset.ironman,
          owner: preset.owner_name,
        },
      });
    } catch (err) {
      console.error("gear presets share GET:", err);
      res.status(500).json({ error: "Could not load preset" });
    }
    return;
  }

  const user = await getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }

  const pro = isProUser(user);

  if (req.method === "GET") {
    try {
      const presets = await listGearPresets(user.id);
      res.status(200).json({ ok: true, pro, presets, limit: pro ? null : FREE_PRESET_LIMIT });
    } catch (err) {
      console.error("gear presets GET:", err);
      res.status(500).json({ error: "Could not load presets" });
    }
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    try {
      if (!pro) {
        const count = await countGearPresets(user.id);
        if (count >= FREE_PRESET_LIMIT) {
          res.status(403).json({ error: "Preset limit reached", upgrade: "/upgrade" });
          return;
        }
      }
      if (!body.name?.trim()) {
        res.status(400).json({ error: "Name required" });
        return;
      }
      const preset = await createGearPreset(user.id, {
        shareId: genShareId(),
        name: body.name.trim(),
        goal: body.goal?.trim() || null,
        monsterId: body.monsterId ? Number(body.monsterId) : null,
        slots: body.slots || {},
        prayers: body.prayers || [],
        combatStyle: body.combatStyle || "melee",
        isPublic: body.isPublic !== false,
        ironman: Boolean(body.ironman),
        folder: pro ? body.folder || null : null,
      });
      res.status(200).json({ ok: true, preset });
    } catch (err) {
      console.error("gear presets POST:", err);
      res.status(500).json({ error: "Could not save preset" });
    }
    return;
  }

  if (req.method === "PUT") {
    const id = Number(bodyId(req));
    const body = req.body || {};
    if (!id) {
      res.status(400).json({ error: "Preset id required" });
      return;
    }
    try {
      const preset = await updateGearPreset(user.id, id, {
        name: body.name?.trim(),
        goal: body.goal,
        monsterId: body.monsterId != null ? Number(body.monsterId) : undefined,
        slots: body.slots,
        prayers: body.prayers,
        combatStyle: body.combatStyle,
        isPublic: body.isPublic,
        ironman: body.ironman,
        folder: pro ? body.folder : undefined,
      });
      if (!preset) {
        res.status(404).json({ error: "Preset not found" });
        return;
      }
      res.status(200).json({ ok: true, preset });
    } catch (err) {
      console.error("gear presets PUT:", err);
      res.status(500).json({ error: "Could not update preset" });
    }
    return;
  }

  if (req.method === "DELETE") {
    const id = Number(bodyId(req));
    if (!id) {
      res.status(400).json({ error: "Preset id required" });
      return;
    }
    try {
      await deleteGearPreset(user.id, id);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Could not delete preset" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
