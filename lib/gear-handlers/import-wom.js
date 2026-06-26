const { requireAuth } = require("../auth.js");
const { fetchPlayer, extractEquipment } = require("../wom.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const username = String(req.body?.username || "")
    .trim()
    .toLowerCase();
  if (!username) {
    res.status(400).json({ error: "Username required" });
    return;
  }

  try {
    const player = await fetchPlayer(username);
    if (!player) {
      res.status(404).json({ ok: false, error: "Player not found on Wise Old Man" });
      return;
    }

    const slots = extractEquipment(player);
    if (!slots) {
      res.status(200).json({
        ok: false,
        error: "No gear data for this player.",
        hint: "Wise Old Man does not store worn equipment — set gear manually.",
      });
      return;
    }

    res.status(200).json({ ok: true, slots, displayName: player.displayName || username });
  } catch (err) {
    console.error("gear import-wom:", err);
    res.status(500).json({ error: "Import failed" });
  }
};
