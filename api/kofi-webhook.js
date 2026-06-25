import { extendProByEmail, recordKofiEvent } from "../../lib/db.mjs";

const PRO_TIER = "Graardor Pro";

function parseKofiPayload(req) {
  let raw = req.body;
  if (typeof raw === "string") {
    const params = new URLSearchParams(raw);
    raw = params.get("data");
  }
  if (raw?.data) raw = raw.data;
  if (typeof raw === "string") return JSON.parse(raw);
  if (typeof raw === "object" && raw.verification_token) return raw;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let payload;
  try {
    payload = parseKofiPayload(req);
  } catch {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  if (!payload) {
    res.status(400).json({ error: "Missing data" });
    return;
  }

  const verificationToken = process.env.KO_FI_VERIFICATION_TOKEN;
  if (verificationToken && payload.verification_token !== verificationToken) {
    res.status(401).json({ error: "Invalid verification token" });
    return;
  }

  const type = payload.type || "";
  const email = payload.email || payload.from_email || payload.shop_buyer_email || null;
  const tierName = payload.tier_name || payload.subscription_tier || null;
  const isSubscription = type === "Subscription" || type === "subscription";
  const isProTier = tierName && tierName.toLowerCase() === PRO_TIER.toLowerCase();

  try {
    await recordKofiEvent({
      transactionId: payload.kofi_transaction_id || payload.message_id || `${Date.now()}`,
      email,
      amount: payload.amount || null,
      tierName,
      type,
      raw: payload,
    });

    if (isSubscription && isProTier && email) {
      await extendProByEmail(email, 32);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Ko-fi webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
