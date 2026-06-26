const { getAuthedUser, isProUser } = require("../../lib/auth.js");
const { getGearUpgradeUses, incrementGearUpgradeUses } = require("../../lib/db.js");
const { rankUpgrades } = require("../../lib/gear-calc.js");
const {
  getItemsMeta,
  getPrayersMeta,
  getUpgradePools,
  getMonster,
  fetchGePrices,
  priceLookup,
} = require("../../lib/gear-data.js");

const FREE_UPGRADE_VIEWS = 3;
const FREE_UPGRADE_ROWS = 3;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await getAuthedUser(req);
  const pro = user ? isProUser(user) : false;

  const body = req.body || {};
  const monsterId = Number(body.monsterId);
  const monster = getMonster(monsterId);
  if (!monster) {
    res.status(400).json({ error: "Unknown monster" });
    return;
  }

  if (!pro) {
    if (!user) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    const uses = await getGearUpgradeUses(user.id);
    if (uses >= FREE_UPGRADE_VIEWS) {
      res.status(403).json({
        error: "Upgrade views used",
        usesRemaining: 0,
        upgrade: "/upgrade",
      });
      return;
    }
    await incrementGearUpgradeUses(user.id);
  }

  try {
    const itemsMeta = getItemsMeta();
    const prayersMeta = getPrayersMeta();
    const pools = getUpgradePools()?.pools || {};
    const latest = await fetchGePrices();
    const getPrice = (id) => priceLookup(latest, id);

    const stats = body.stats || {
      attack: 75,
      strength: 75,
      defence: 75,
      ranged: 75,
      magic: 75,
      hitpoints: 99,
    };

    const { base, upgrades } = rankUpgrades({
      stats,
      slots: body.slots || {},
      prayers: body.prayers || [],
      combatStyle: body.combatStyle || "melee",
      monster,
      itemsMeta,
      prayersMeta,
      pools,
      getPrice,
      ironman: Boolean(body.ironman),
    });

    const total = upgrades.length;
    const slice = pro ? upgrades : upgrades.slice(0, FREE_UPGRADE_ROWS);
    let usesRemaining = null;
    if (!pro && user) {
      const usesAfter = await getGearUpgradeUses(user.id);
      usesRemaining = Math.max(0, FREE_UPGRADE_VIEWS - usesAfter);
    }

    res.status(200).json({
      ok: true,
      pro,
      base: pro
        ? base
        : {
            dps: base.dps,
            maxHit: base.maxHit,
            hitChance: base.hitChance,
            killsPerHour: null,
            xpPerHour: null,
            gpPerHour: null,
            avgLoot: null,
          },
      upgrades: slice,
      lockedCount: pro ? 0 : Math.max(0, total - FREE_UPGRADE_ROWS),
      usesRemaining,
    });
  } catch (err) {
    console.error("gear upgrades:", err);
    res.status(500).json({ error: "Could not calculate upgrades" });
  }
};
