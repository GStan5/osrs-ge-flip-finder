module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const hasToken = Boolean(process.env.KO_FI_VERIFICATION_TOKEN);
  const hasDb = Boolean(process.env.DATABASE_URL);

  if (!hasDb) {
    res.status(200).json({
      ok: false,
      message: "DATABASE_URL is not set in Vercel — webhooks cannot be stored yet.",
      hasVerificationToken: hasToken,
      recentEvents: [],
    });
    return;
  }

  try {
    const { getRecentKofiEvents } = require("../lib/db.js");
    const recentEvents = await getRecentKofiEvents(5);
    res.status(200).json({
      ok: true,
      message: recentEvents.length
        ? "Ko-fi webhooks are reaching Graardor. Recent events below."
        : "No Ko-fi events stored yet — send a test from ko-fi.com/manage/webhooks.",
      hasVerificationToken: hasToken,
      webhookUrl: "https://www.graardor.com/api/kofi-webhook",
      recentEvents: recentEvents.map((e) => ({
        type: e.event_type,
        amount: e.amount,
        tier: e.tier_name,
        email: e.email ? "yes" : "no",
        at: e.created_at,
      })),
    });
  } catch (err) {
    console.error("kofi-status error:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
      hasVerificationToken: hasToken,
    });
  }
};
