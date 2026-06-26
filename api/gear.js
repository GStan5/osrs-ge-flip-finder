const ROUTES = {
  presets: require("../lib/gear-handlers/presets.js"),
  profiles: require("../lib/gear-handlers/profiles.js"),
  upgrades: require("../lib/gear-handlers/upgrades.js"),
  "import-wom": require("../lib/gear-handlers/import-wom.js"),
};

function resolveRoute(req) {
  const q = req.query?.route;
  if (q && ROUTES[q]) return q;

  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const suffix = pathname.replace(/^\/api\/gear\/?/, "");
    if (suffix && ROUTES[suffix]) return suffix;
  } catch {
    /* ignore */
  }

  return null;
}

module.exports = async function handler(req, res) {
  const route = resolveRoute(req);
  if (!route) {
    res.status(404).json({ error: "Unknown gear route" });
    return;
  }
  return ROUTES[route](req, res);
};
