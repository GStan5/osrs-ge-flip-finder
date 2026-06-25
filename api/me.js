const { parseSessionToken, readSessionCookie } = require("../lib/session.js");

module.exports = async function handler(req, res) {
  const token = readSessionCookie(req);
  const session = parseSessionToken(token);
  if (!session) {
    res.status(200).json({ user: null, pro: false });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.status(200).json({ user: null, pro: false });
    return;
  }

  try {
    const { getUserByDiscordId } = require("../lib/db.js");
    const user = await getUserByDiscordId(session.discordId);
    if (!user) {
      res.status(200).json({ user: null, pro: false });
      return;
    }

    const proUntil = user.pro_until ? new Date(user.pro_until) : null;
    const pro = proUntil ? proUntil.getTime() > Date.now() : false;

    res.status(200).json({
      user: {
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
      pro,
      proUntil: proUntil ? proUntil.toISOString() : null,
    });
  } catch (err) {
    console.error("/api/me error:", err);
    res.status(500).json({ error: "Could not load session" });
  }
};
