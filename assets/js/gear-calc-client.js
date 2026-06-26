(function (G) {
  const SLOT_KEYS = ["head", "cape", "amulet", "weapon", "body", "legs", "shield", "gloves", "boots", "ring", "ammo"];

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
    for (const pid of prayerIds || []) {
      const p = prayersMeta?.prayers?.[String(pid)];
      if (!p?.bonuses) continue;
      if (style === "melee") {
        atkPct = Math.max(atkPct, p.bonuses.attack || 0);
        strPct = Math.max(strPct, p.bonuses.strength || 0);
      } else if (style === "ranged") {
        atkPct = Math.max(atkPct, p.bonuses.ranged || 0);
        strPct = Math.max(strPct, p.bonuses.ranged_strength || p.bonuses.strength || 0);
      } else if (style === "magic") {
        atkPct = Math.max(atkPct, p.bonuses.magic || 0);
        strPct = Math.max(strPct, p.bonuses.magic_strength || 0);
      }
    }
    return { atkPct, strPct };
  }

  function calcDps({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta }) {
    const style = combatStyle || "melee";
    const lv = {
      attack: stats?.attack ?? 1,
      strength: stats?.strength ?? 1,
      defence: stats?.defence ?? 1,
      ranged: stats?.ranged ?? 1,
      magic: stats?.magic ?? 1,
    };
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

    const mLv = monster?.levels || {};
    const mDef = monster?.defence || {};
    let monDef;
    if (style === "magic") monDef = (mLv.magic ?? 1) + (mDef.magic || 0);
    else if (style === "ranged") monDef = (mLv.ranged ?? 1) + (mDef.ranged || 0);
    else monDef = (mLv.defence ?? 1) + Math.max(mDef.stab || 0, mDef.slash || 0, mDef.crush || 0);

    const hitChance = Math.min(0.95, Math.max(0.05, (effAtk + gearAtk - monDef) / (effAtk + gearAtk + monDef + 64)));
    const maxHit = Math.max(1, Math.floor(0.5 + (effStr * (gearStr + 64)) / 640));
    const attackSpeed = 4;
    const avgDps = (maxHit * 0.5 * hitChance) / (attackSpeed * 0.6);

    return { avgDps, maxHit, hitChance };
  }

  function expectedDropValue(monster, getPrice) {
    let ev = 0;
    for (const drop of monster?.drops || []) {
      const price = getPrice?.(drop.id);
      if (price == null) continue;
      let qty = 1;
      const q = String(drop.quantity || "1");
      const range = q.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) qty = (Number(range[1]) + Number(range[2])) / 2;
      else qty = Number(q) || 1;
      ev += (drop.rarity || 0) * (drop.rolls || 1) * qty * price;
    }
    return ev;
  }

  function calcStats({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta, getPrice }) {
    const dps = calcDps({ stats, slots, prayers, combatStyle, monster, itemsMeta, prayersMeta });
    const hp = monster?.hitpoints || 1;
    const killsPerHour = dps.avgDps > 0 ? 3600 / (hp / dps.avgDps) : 0;
    const styleXp = hp * 4;
    const slayerXp = monster?.slayer?.xp || 0;
    const hitpointsXp = Math.floor(hp / 3);
    const xpPerHour = (styleXp + slayerXp + hitpointsXp) * killsPerHour;
    const dropEv = expectedDropValue(monster, getPrice);
    const gpPerHour = dropEv * killsPerHour;

    return {
      dps: Math.round(dps.avgDps * 100) / 100,
      maxHit: dps.maxHit,
      hitChance: Math.round(dps.hitChance * 1000) / 10,
      killsPerHour: Math.round(killsPerHour * 10) / 10,
      xpPerHour: Math.round(xpPerHour),
      gpPerHour: Math.round(gpPerHour),
      avgLoot: Math.round(dropEv),
      equipment: aggregateEquipment(slots, itemsMeta),
    };
  }

  G.gearCalc = { SLOT_KEYS, aggregateEquipment, calcStats };
})(window.Graardor);
