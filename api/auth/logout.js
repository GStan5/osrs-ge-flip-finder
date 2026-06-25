import { clearSessionCookie } from "../../lib/session.mjs";

export default function handler(_req, res) {
  clearSessionCookie(res);
  res.redirect(302, "/");
}
