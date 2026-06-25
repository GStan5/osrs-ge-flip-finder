const { requirePro } = require("../lib/auth.js");
const { getUserAlerts, createAlert, deleteAlert } = require("../lib/db.js");

module.exports = async function handler(req, res) {
  const user = await requirePro(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const alerts = await getUserAlerts(user.id);
      res.status(200).json({ ok: true, alerts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    const { itemId, itemName, direction, targetPrice, webhookUrl } = req.body || {};
    if (!itemId || !itemName || !direction || !targetPrice || !webhookUrl) {
      res.status(400).json({ error: "Missing alert fields" });
      return;
    }
    if (!["above", "below"].includes(direction)) {
      res.status(400).json({ error: "direction must be above or below" });
      return;
    }
    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      res.status(400).json({ error: "Discord webhook URL required" });
      return;
    }
    try {
      const alert = await createAlert(user.id, {
        itemId: Number(itemId),
        itemName,
        direction,
        targetPrice: Number(targetPrice),
        webhookUrl,
      });
      res.status(200).json({ ok: true, alert });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "DELETE") {
    const id = Number(req.query?.id);
    if (!id) {
      res.status(400).json({ error: "Alert id required" });
      return;
    }
    try {
      await deleteAlert(user.id, id);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
