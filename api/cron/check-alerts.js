const { getActiveAlerts, markAlertTriggered } = require("../lib/db.js");

const WIKI_API = "https://prices.runescape.wiki/api/v1/osrs";
const USER_AGENT = "Graardor - alert cron (graardor.com)";

async function fetchLatestPrices() {
  const res = await fetch(`${WIKI_API}/latest`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wiki API ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function sendDiscordWebhook(webhookUrl, content) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

function alertTriggered(alert, price) {
  if (alert.direction === "above") return price >= alert.target_price;
  return price <= alert.target_price;
}

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.status(200).json({ ok: false, message: "No database" });
    return;
  }

  try {
    const [alerts, latest] = await Promise.all([getActiveAlerts(), fetchLatestPrices()]);
    let fired = 0;

    for (const alert of alerts) {
      const row = latest[alert.item_id];
      if (!row) continue;
      const price = alert.direction === "above" ? row.high : row.low;
      if (price == null) continue;

      const cooldownMs = 60 * 60 * 1000;
      if (alert.last_triggered && Date.now() - new Date(alert.last_triggered).getTime() < cooldownMs) {
        continue;
      }

      if (!alertTriggered(alert, price)) continue;

      const msg = `**Graardor alert** — ${alert.item_name} is ${alert.direction} **${alert.target_price.toLocaleString()}** gp (now **${price.toLocaleString()}**)`;
      try {
        await sendDiscordWebhook(alert.webhook_url, msg);
        await markAlertTriggered(alert.id);
        fired += 1;
      } catch (err) {
        console.error("Alert webhook failed:", alert.id, err.message);
      }
    }

    res.status(200).json({ ok: true, checked: alerts.length, fired });
  } catch (err) {
    console.error("check-alerts error:", err);
    res.status(500).json({ error: err.message });
  }
};
