const { getBaseUrl } = require("../../lib/url.js");

module.exports = function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Discord login is not configured yet." });
    return;
  }

  const redirectUri = encodeURIComponent(`${getBaseUrl(req)}/api/auth/discord/callback`);
  const scope = encodeURIComponent("identify email");
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  res.redirect(302, url);
};
