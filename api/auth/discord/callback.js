const { createSessionToken, setSessionCookie } = require("../../../lib/session.js");
const { getDiscordRedirectUri } = require("../../../lib/url.js");

module.exports = async function handler(req, res) {
  const code = req.query?.code;
  if (!code) {
    res.redirect(302, "/?auth=missing");
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.redirect(302, "/?auth=unconfigured");
    return;
  }

  const redirectUri = getDiscordRedirectUri(req);

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      res.redirect(302, "/?auth=token_failed");
      return;
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      res.redirect(302, "/?auth=user_failed");
      return;
    }

    const discord = await userRes.json();
    const { upsertDiscordUser } = require("../../../lib/db.js");
    const user = await upsertDiscordUser({
      discordId: discord.id,
      username: discord.global_name || discord.username,
      email: discord.email ?? null,
      avatar: discord.avatar
        ? `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.png`
        : null,
    });

    const sessionToken = createSessionToken(user);
    setSessionCookie(res, sessionToken);
    res.redirect(302, "/");
  } catch (err) {
    console.error("Discord callback error:", err);
    res.redirect(302, "/?auth=error");
  }
};
