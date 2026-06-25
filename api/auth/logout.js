const { clearSessionCookie } = require("../../lib/session.js");

module.exports = function handler(_req, res) {
  clearSessionCookie(res);
  res.redirect(302, "/");
};
