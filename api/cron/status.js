const { getCronRun } = require("../../lib/db.js");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=60");

  if (!process.env.DATABASE_URL) {
    res.status(200).json({
      configured: false,
      database: false,
      message: "No database configured — alerts cannot run server-side.",
    });
    return;
  }

  try {
    const lastRun = await getCronRun("check-alerts");
    res.status(200).json({
      configured: Boolean(process.env.CRON_SECRET),
      database: true,
      intervalMinutes: 15,
      lastRun: lastRun
        ? {
            at: lastRun.at || lastRun.updatedAt,
            ok: lastRun.ok,
            checked: lastRun.checked,
            fired: lastRun.fired,
            error: lastRun.error || null,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
