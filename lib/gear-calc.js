/**
 * Gear planner combat & efficiency calculations (server + client).
 *
 * DPS v1 (simplified, not full OSRS hit formula):
 *   effectiveLevel = floor(combatLevel + prayerPctBonus) + 8
 *   maxHit = floor(0.5 + effectiveStr * (gearStr + 64) / 640)
 *   hitChance = clamp((effAtk - monDef) / (effAtk + monDef + 64), 0.05, 0.95)
 *   avgDps = maxHit * 0.5 * hitChance / attackIntervalSec
 *   killsPerHour = 3600 / (monsterHp / avgDps)
 */

const SLOT_KEYS = ["head", "cape", "amulet", "weapon", "body", "legs", "shield", "gloves", "boots", "ring", "ammo"];

const META_SLOT_MAP = {
  head: "head",
  cape: "cape",
  amulet: "neck",
  weapon: ["weapon", "2h"],
  body: "body",
  legs: "legs",
  shield: "shield",
  gloves: "hands",
  boots: "feet",
  ring: "ring",
  ammo: "ammo",
};

const STYLE_ATTACK_KEY = {
  melee: "slash",
  ranged: "ranged",
  magic: "magic",
};

function sumBonuses(slots, itemsMeta, prayersMeta, prayerIds, field) {
  let total = 0;
  for (const slot of SLOT_KEYS) {
    const id = slots?.[slot];
    if (!id) continue;
    const item = itemsMeta?.items?.[String(id)];
    if (!item) continue;
    if (field === "strength") total += item.strength || 0;
    else if (field === "rangedStrength") total += item.rangedStrength || 0;
    else if (field === "magicDamage") total += item.magicDamage || 0;
    else if (field === "prayer") total += item.prayer || 0;
    else if (item.attack) {
      const key = STYLE_ATTACK_KEY[field] || field;
      total += item.attack[key] || 0;
    } else if (item.defence) {
      total += item.defence[field] || 0;
    }
  }
  for (const pid of prayerIds || []) {
    const p = prayersMeta?.prayers?.[String(pid)];
    if (!p?.bonuses) continue;
    if (field === "strength" && p.bonuses.strength) total += Math.floor((p.bonuses.strength / 100) * 100);
    if (field === "attack" && p.bonuses.attack) total += Math.floor((p.bonuses.attack / 100) * 100);
    if (field === "ranged" && p.bonuses.ranged) total += Math.floor((p.bonuses.ranged / 100) * 100);
    if (field === "magic" && p.bonuses.magic) total += Math.floor((p.bonuses.magic / 100) * 100);
    if (field === "defence" && p.bonuses.defence) total += Math.floor((p.bonuses.defence / 100) * 100);
  }
  return total;
}

function aggregateEquipment(slots, itemsMeta) {
  const attack = { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 };
  const defence = { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 };
  let strength = 0;
  let rangedStrength = 0;
  let magicDamage = 0;
  let prayer = 0;

  for (const slot of SLOT_KEYS) {
    const id = slots?.[slot];
    if (!id) continue;
    const item = itemsMeta?.items?.[String(id)];
    if (!item) continue;
    if (item.attack) {
      for (const k of Object.keys(attack)) attack[k] += item.attack[k] || 0;
    }
    if (item.defence) {
      for (const k of Object.keys(defence)) defence[k] += item.defence[k] || 0;
    }
    strength += item.strength || 0;
    rangedStrength += item.rangedStrength || 0;
    magicDamage += item.magicDamage || 0;
    prayer += item.prayer || 0;
  }

  return { attack, defence, strength, rangedStrength, magicDamage, prayer };
}

function prayerMultipliers(prayerIds, prayersMeta, style) {
  let atkPct = 0;
  let strPct = 0;
  let defPct = 0;
  for (const pid of prayerIds || []) {
    const p = prayersMeta?.prayers?.[String(pid)];
    if (!p?.bonuses) continue;
    if (style === "melee") {
      atkPct = Math.max(atkPct, p.bonuses.attack || 0);
      strPct = Math.max(strPct, p.bonuses.strength || 0);
      defPct = Math.max(defPct, p.bonuses.defence || 0);
    } else if (style === "ranged") {
      atkPct = Math.max(atkPct, p.bonuses.ranged || 0);
      strPct = Math.max(strPct, p.bonuses.ranged_strength || p.bonuses.strength || 0);
    } else if (style === "magic") {
      atkPct = Math.max(atkPct, p.bonuses.magic || 0);
      strPct = Math.max(strPct, p.bonuses.magic_strength || 0);
    }
  }
  return { atkPct, strPct, defPct };
}

function combatLevels(stats) {
  return {
    attack: stats?.attack ?? 1,
    strength: stats?.strength ?? 1,
    defence: stats?.defence ?? 1,
    ranged: stats?.ranged ?? 1,
    magic: stats?.magic ?? 1,
    hitpoints: stats?.hitpoints ?? 10,
  };
}

function estimateCombat(stats, style) {
  const lv = combatLevels(stats);
  if (style === "ranged") return lv.ranged;
  if (style === "magic") return lv.magic;
  return Math.max(lv.attack, lv.strength);
}

function monsterDefenceLevel(monster, style) {
  const lv = monster?.levels || {};
  if (style === "magic") return lv.magic ?? 1;
  if (style === "ranged") return lv.ranged ?? 1;
  return lv.defence ?? 1;
}

function monsterDefenceBonus(monster, style) {
  const def = monster?.defence || {};
  if (style === "magic") return def.magic || 0;
  if (style === "ranged") return def.ranged || 0;
  return Math.max(def.stab || 0, def.slash || 0, def.crush || 0);
}

function calcDps({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta }) {
  const style = combatStyle || "melee";
  const lv = combatLevels(stats);
  const gear = aggregateEquipment(slots, itemsMeta);
  const pm = prayerMultipliers(prayers, prayersMeta, style);

  let effAtk;
  let effStr;
  let gearAtk;
  let gearStr;

  if (style === "ranged") {
    effAtk = Math.floor(lv.ranged * (1 + pm.atkPct / 100)) + 8;
    effStr = Math.floor(lv.ranged * (1 + pm.strPct / 100)) + 8;
    gearAtk = gear.attack.ranged;
    gearStr = gear.rangedStrength;
  } else if (style === "magic") {
    effAtk = Math.floor(lv.magic * (1 + pm.atkPct / 100)) + 8;
    effStr = Math.floor(lv.magic * (1 + pm.strPct / 100)) + 8;
    gearAtk = gear.attack.magic;
    gearStr = gear.magicDamage;
  } else {
    effAtk = Math.floor(Math.max(lv.attack, lv.strength) * (1 + pm.atkPct / 100)) + 8;
    effStr = Math.floor(lv.strength * (1 + pm.strPct / 100)) + 8;
    gearAtk = Math.max(gear.attack.stab, gear.attack.slash, gear.attack.crush);
    gearStr = gear.strength;
  }

  const monDef = monsterDefenceLevel(monster, style) + monsterDefenceBonus(monster, style);
  const hitChance = Math.min(0.95, Math.max(0.05, (effAtk + gearAtk - monDef) / (effAtk + gearAtk + monDef + 64)));
  const maxHit = Math.max(1, Math.floor(0.5 + (effStr * (gearStr + 64)) / 640));
  const attackSpeed = monster?.attackSpeed || 4;
  const intervalSec = attackSpeed * 0.6;
  const avgDps = (maxHit * 0.5 * hitChance) / intervalSec;

  return { avgDps, maxHit, hitChance, effAtk, effStr, gearAtk, gearStr };
}

function calcKillsPerHour(dps, monster) {
  const hp = monster?.hitpoints || 1;
  if (!dps?.avgDps || dps.avgDps <= 0) return 0;
  const killSec = hp / dps.avgDps;
  if (killSec <= 0) return 0;
  return 3600 / killSec;
}

function combatXpPerKill(monster, style) {
  const hp = monster?.hitpoints || 0;
  const styleXp = hp * 4;
  const slayerXp = monster?.slayer?.xp || 0;
  const hitpointsXp = Math.floor(hp / 3);
  return {
    style: styleXp,
    hitpoints: hitpointsXp,
    slayer: slayerXp,
    total: styleXp + hitpointsXp + slayerXp,
  };
}

function expectedDropValue(monster, getPrice) {
  const drops = monster?.drops || [];
  let ev = 0;
  for (const drop of drops) {
    const price = getPrice(drop.id);
    if (price == null) continue;
    let qty = 1;
    const q = String(drop.quantity || "1");
    const range = q.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) qty = (Number(range[1]) + Number(range[2])) / 2;
    else qty = Number(q) || 1;
    const rolls = drop.rolls || 1;
    ev += (drop.rarity || 0) * rolls * qty * price;
  }
  return ev;
}

function calcStats({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta, getPrice }) {
  const dps = calcDps({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta });
  const killsPerHour = calcKillsPerHour(dps, monster);
  const xp = combatXpPerKill(monster, combatStyle);
  const xpPerHour = xp.total * killsPerHour;
  const dropEv = expectedDropValue(monster, getPrice);
  const gpPerHour = dropEv * killsPerHour;
  const gear = aggregateEquipment(slots, itemsMeta);

  return {
    dps: Math.round(dps.avgDps * 100) / 100,
    maxHit: dps.maxHit,
    hitChance: Math.round(dps.hitChance * 1000) / 10,
    killsPerHour: Math.round(killsPerHour * 10) / 10,
    xpPerHour: Math.round(xpPerHour),
    gpPerHour: Math.round(gpPerHour),
    avgLoot: Math.round(dropEv),
    combatXpPerKill: xp,
    equipment: gear,
  };
}

function effortScore(obtain) {
  const tags = obtain || ["ge"];
  if (tags.includes("quest")) return 10;
  if (tags.includes("drop")) return 5;
  return 1;
}

function rankUpgrades({
  stats,
  slots,
  prayers,
  combatStyle,
  monster,
  itemsMeta,
  prayersMeta,
  pools,
  getPrice,
  ironman,
}) {
  const base = calcStats({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta, getPrice });
  const results = [];

  for (const slot of SLOT_KEYS) {
    const currentId = slots?.[slot];
    const candidates = pools?.[slot] || [];
    for (const cand of candidates) {
      if (String(cand.id) === String(currentId)) continue;
      const nextSlots = { ...slots, [slot]: cand.id };
      if (slot === "weapon" && itemsMeta?.items?.[String(cand.id)]?.slot === "2h") {
        nextSlots.shield = null;
      }
      const next = calcStats({
        stats,
        slots: nextSlots,
        prayers,
        combatStyle,
        monster,
        itemsMeta,
        prayersMeta,
        getPrice,
      });
      const deltaDps = next.dps - base.dps;
      const deltaGpHr = next.gpPerHour - base.gpPerHour;
      const price = ironman ? null : getPrice(cand.id);
      const obtain = cand.obtain || ["ge"];
      const effort = effortScore(obtain);

      let efficiency;
      if (ironman) {
        efficiency = deltaDps > 0 ? deltaDps / effort : deltaGpHr / effort;
      } else if (price && price > 0) {
        efficiency = (deltaGpHr || deltaDps * 100000) / price;
      } else {
        efficiency = deltaDps;
      }

      if (deltaDps <= 0 && deltaGpHr <= 0) continue;

      results.push({
        slot,
        itemId: cand.id,
        name: cand.name,
        deltaDps: Math.round(deltaDps * 100) / 100,
        deltaGpHr: Math.round(deltaGpHr),
        price: price ?? null,
        efficiency: Math.round(efficiency * 10000) / 10000,
        obtain,
        effort,
      });
    }
  }

  results.sort((a, b) => b.efficiency - a.efficiency);
  return { base, upgrades: results };
}

module.exports = {
  SLOT_KEYS,
  META_SLOT_MAP,
  aggregateEquipment,
  calcStats,
  calcDps,
  calcKillsPerHour,
  rankUpgrades,
  effortScore,
};
