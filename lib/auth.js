const { parseSessionToken, readSessionCookie } = require("./session.js");
const { getUserByDiscordId } = require("./db.js");

function isProUser(user) {
  if (!user?.pro_until) return false;
  return new Date(user.pro_until).getTime() > Date.now();
}

async function getAuthedUser(req) {
  const token = readSessionCookie(req);
  const session = parseSessionToken(token);
  if (!session) return null;
  if (!process.env.DATABASE_URL) return null;
  return getUserByDiscordId(session.discordId);
}

async function requireAuth(req, res) {
  const user = await getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  return user;
}

async function requirePro(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!isProUser(user)) {
    res.status(403).json({ error: "Graardor Pro required", upgrade: "/upgrade" });
    return null;
  }
  return user;
}

module.exports = { getAuthedUser, requireAuth, requirePro, isProUser };
