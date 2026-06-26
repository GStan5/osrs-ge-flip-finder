function getBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

function requestHost(req) {
  const raw = req.headers["x-forwarded-host"] || req.headers.host || "";
  return String(raw).split(",")[0].trim().replace(/:\d+$/, "");
}

/** Canonical Discord OAuth callback for production Graardor (www + apex). */
const GRAARDOR_DISCORD_CALLBACK =
  "https://www.graardor.com/api/auth/discord/callback";

/**
 * OAuth redirect_uri must match Discord Developer Portal exactly.
 * Prefer DISCORD_REDIRECT_URI in Vercel; normalize graardor.com → www for apex hits.
 */
function getDiscordRedirectUri(req) {
  if (process.env.DISCORD_REDIRECT_URI) {
    return process.env.DISCORD_REDIRECT_URI;
  }

  const host = requestHost(req);
  if (host === "graardor.com" || host === "www.graardor.com") {
    return GRAARDOR_DISCORD_CALLBACK;
  }

  return `${getBaseUrl(req)}/api/auth/discord/callback`;
}

module.exports = { getBaseUrl, getDiscordRedirectUri, GRAARDOR_DISCORD_CALLBACK };
