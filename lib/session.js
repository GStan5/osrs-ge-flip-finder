const crypto = require("crypto");

const COOKIE_NAME = "graardor_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return s;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function createSessionToken(user) {
  const body = Buffer.from(
    JSON.stringify({
      discordId: user.discord_id,
      exp: Date.now() + MAX_AGE_SEC * 1000,
    })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function parseSessionToken(token) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || sign(body) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data.discordId || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const secure = process.env.VERCEL_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function readSessionCookie(req) {
  const raw = req.headers.cookie || "";
  const match = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = {
  COOKIE_NAME,
  createSessionToken,
  parseSessionToken,
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
};
