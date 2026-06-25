const { recordFlipAggregate, getTopFlipAggregates } = require("../lib/db.js");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const days = Math.min(Number(req.query?.days) || 7, 30);
    try {
      if (!process.env.DATABASE_URL) {
        res.status(200).json({ ok: true, items: [], message: "No database configured" });
        return;
      }
      const items = await getTopFlipAggregates(days, 25);
      res.status(200).json({ ok: true, days, items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    const { itemName, itemId, profit, optIn } = req.body || {};
    if (!optIn) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }
    if (!itemName) {
      res.status(400).json({ error: "itemName required" });
      return;
    }
    try {
      if (!process.env.DATABASE_URL) {
        res.status(200).json({ ok: true, stored: false });
        return;
      }
      await recordFlipAggregate(itemName, itemId ? Number(itemId) : null, Number(profit) || 0);
      res.status(200).json({ ok: true, stored: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
