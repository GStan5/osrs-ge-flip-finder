const PRO_TIER = "Graardor Pro";

function parseKofiPayload(req) {
  const body = req.body;

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      const params = new URLSearchParams(body);
      const data = params.get("data");
      if (data) return JSON.parse(data);
    }
  }

  if (body && typeof body === "object") {
    if (body.verification_token) return body;
    if (typeof body.data === "string") return JSON.parse(body.data);
    if (body.data && typeof body.data === "object") return body.data;
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      message: "Graardor Ko-fi webhook is reachable. POST payment events here.",
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let payload;
  try {
    payload = parseKofiPayload(req);
  } catch (err) {
    console.error("Ko-fi parse error:", err);
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  if (!payload) {
    res.status(400).json({ error: "Missing data" });
    return;
  }

  const verificationToken = process.env.KO_FI_VERIFICATION_TOKEN;
  if (verificationToken && payload.verification_token !== verificationToken) {
    console.warn("Ko-fi webhook rejected: bad verification token");
    res.status(401).json({ error: "Invalid verification token" });
    return;
  }

  const type = payload.type || "";
  const email = payload.email || payload.from_email || payload.shop_buyer_email || null;
  const tierName = payload.tier_name || payload.subscription_tier || null;
  const isSubscription = type === "Subscription" || type === "subscription";
  const isProTier = tierName && tierName.toLowerCase() === PRO_TIER.toLowerCase();

  try {
    const { recordKofiEvent, extendProByEmail } = require("../lib/db.js");

    await recordKofiEvent({
      transactionId: payload.kofi_transaction_id || payload.message_id || `${Date.now()}`,
      email,
      amount: payload.amount || null,
      tierName,
      type,
      raw: payload,
    });

    if (isSubscription && isProTier && email) {
      const updated = await extendProByEmail(email, 32);
      console.log("Ko-fi Pro extended:", email, updated ? "matched user" : "no discord user with email");
    } else {
      console.log("Ko-fi event recorded:", type, tierName || "no tier", email || "no email");
    }

    res.status(200).json({ ok: true, type, tierName, email: email ? "received" : "none" });
  } catch (err) {
    console.error("Ko-fi webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed", detail: err.message });
  }
};
