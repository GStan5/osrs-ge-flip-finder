/**
 * Builds full GE recipe catalog from OSRS Wiki Bucket + instant transforms.
 * Run: node scripts/build-recipes.mjs
 * Output: data/recipes.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "data", "recipes.json");

const USER_AGENT = "OSRS-GE-Flipper/1.0 (recipe catalog builder)";
const PRICE_API = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const WIKI_API = "https://oldschool.runescape.wiki/api.php";

const DOSE_EXCLUDE = new Set([
  "Amulet of glory",
  "Amulet of glory (t)",
  "Ring of recoil",
  "Ring of forging",
  "Ring of dueling",
  "Games necklace",
  "Skills necklace",
  "Combat bracelet",
  "Ring of returning",
]);

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function bucketQuery(query) {
  const params = new URLSearchParams({
    action: "bucket",
    format: "json",
    formatversion: "2",
    query,
  });
  return fetchJson(`${WIKI_API}?${params}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseComponents(wikitext) {
  const marker = "==Components==";
  const start = wikitext.indexOf(marker);
  if (start === -1) return null;

  const after = wikitext.slice(start + marker.length);
  const nextSection = after.search(/\n==[^=]/);
  const section = nextSection === -1 ? after : after.slice(0, nextSection);

  const components = [];
  const re = /\{\{CostLine\|([^}|]+?)\}\}/gi;
  let m;
  while ((m = re.exec(section)) !== null) {
    components.push(m[1].trim());
  }
  return components.length ? components : null;
}

async function fetchCategorySetPages() {
  const pages = [];
  let cmcontinue = null;

  do {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: "Category:Item_sets",
      cmlimit: "500",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.categorymembers ?? []));
    cmcontinue = data.continue?.cmcontinue ?? null;
  } while (cmcontinue);

  return pages.filter((p) => p.title !== "Item set" && p.ns === 0);
}

async function fetchWikitextBatch(titles) {
  const result = new Map();
  const chunkSize = 40;

  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    });

    const data = await fetchJson(`${WIKI_API}?${params}`);
    for (const page of Object.values(data.query?.pages ?? {})) {
      const content = page.revisions?.[0]?.slots?.main?.["*"];
      if (content) result.set(page.title, content);
    }

    await sleep(150);
  }

  return result;
}

async function fetchAllBucketRecipes() {
  const all = [];
  let offset = 0;

  while (true) {
    const data = await bucketQuery(
      `bucket('recipe').select('page_name','is_members_only','uses_skill','production_json').limit(5000).offset(${offset}).run()`
    );
    const rows = data.bucket ?? [];
    if (!rows.length) break;
    all.push(...rows);
    offset += rows.length;
    console.log(`  …${all.length} bucket rows`);
    if (rows.length < 5000) break;
    await sleep(200);
  }

  return all;
}

function buildNameLookup(mapping) {
  const byName = new Map();
  for (const item of mapping) {
    byName.set(item.name.toLowerCase(), item);
  }
  return byName;
}

function mapItem(byName, name) {
  if (!name || typeof name !== "string") return null;
  return byName.get(name.trim().toLowerCase()) ?? null;
}

function parseQty(value, fallback = 1) {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseProductionJson(raw) {
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str || typeof str !== "string") return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function normalizeSkill(name) {
  if (!name || !String(name).trim()) return "Other";
  const s = String(name).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function primarySkill(data, usesSkillField) {
  const fromJson = data.skills?.find((s) => s?.name)?.name;
  if (fromJson) return normalizeSkill(fromJson);
  const fromField = (usesSkillField ?? []).find((s) => s && String(s).trim());
  return normalizeSkill(fromField);
}

function buildSkillingRecipes(bucketRows, mapping) {
  const byName = buildNameLookup(mapping);
  const recipes = [];
  const skipped = [];
  const skills = new Set();

  for (const row of bucketRows) {
    const data = parseProductionJson(row.production_json);
    if (!data) {
      skipped.push({ page: row.page_name, reason: "invalid production_json" });
      continue;
    }

    if (!data.output || typeof data.output === "string" || !data.output.name) {
      skipped.push({ page: row.page_name, reason: "no tradeable output" });
      continue;
    }

    if (!Array.isArray(data.materials) || !data.materials.length) {
      skipped.push({ page: row.page_name, reason: "no materials" });
      continue;
    }

    const inputs = [];
    let missingMaterial = null;
    for (const mat of data.materials) {
      const item = mapItem(byName, mat.name);
      if (!item) {
        missingMaterial = mat.name;
        break;
      }
      inputs.push({ id: item.id, name: item.name, qty: parseQty(mat.quantity) });
    }

    if (missingMaterial) {
      skipped.push({
        page: row.page_name,
        recipe: data.name,
        reason: `material not in price API: ${missingMaterial}`,
      });
      continue;
    }

    const outItem = mapItem(byName, data.output.name);
    if (!outItem) {
      skipped.push({
        page: row.page_name,
        recipe: data.name,
        reason: `output not in price API: ${data.output.name}`,
      });
      continue;
    }

    const skill = primarySkill(data, row.uses_skill);
    skills.add(skill);

    const variant =
      data.output.subtxt ||
      data.facilities?.replace(/\[\[|\]\]/g, "") ||
      data.name ||
      row.page_name;

    const members =
      typeof data.members === "boolean"
        ? data.members
        : row.is_members_only?.[0] === true || row.is_members_only === true;

    recipes.push({
      type: "skill",
      name: data.output.name,
      variant,
      skill,
      members,
      wikiPage: row.page_name,
      inputs,
      outputs: [{ id: outItem.id, name: outItem.name, qty: parseQty(data.output.quantity) }],
    });
  }

  recipes.sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return (a.variant ?? "").localeCompare(b.variant ?? "");
  });

  return { recipes, skipped, skills: [...skills].sort() };
}

function buildDecants(mapping) {
  const doseRe = /^(.+?)\(([1-4])\)$/;
  const groups = new Map();

  for (const item of mapping) {
    const m = item.name.match(doseRe);
    if (!m) continue;
    const base = m[1];
    if (DOSE_EXCLUDE.has(base)) continue;
    if (!groups.has(base)) groups.set(base, {});
    groups.get(base)[m[2]] = { id: item.id, name: item.name };
  }

  const decants = [];
  for (const [base, doses] of groups) {
    const available = ["1", "2", "3", "4"].filter((d) => doses[d]);
    if (available.length < 2) continue;
    const doseMap = {};
    for (const d of available) doseMap[d] = doses[d];
    decants.push({
      type: "decant",
      name: base.trim(),
      doses: doseMap,
    });
  }

  decants.sort((a, b) => a.name.localeCompare(b.name));
  return decants;
}

function buildSets(mapping, setPages, wikitextByTitle) {
  const byName = buildNameLookup(mapping);
  const sets = [];
  const skipped = [];

  for (const page of setPages) {
    const wikitext = wikitextByTitle.get(page.title);
    if (!wikitext) {
      skipped.push({ title: page.title, reason: "no wikitext" });
      continue;
    }

    const componentNames = parseComponents(wikitext);
    if (!componentNames) {
      skipped.push({ title: page.title, reason: "no Components section" });
      continue;
    }

    const setItem = mapItem(byName, page.title);
    if (!setItem) {
      skipped.push({ title: page.title, reason: "set not in price API" });
      continue;
    }

    const components = [];
    let missingComponent = null;
    for (const name of componentNames) {
      const item = mapItem(byName, name);
      if (!item) {
        missingComponent = name;
        break;
      }
      components.push({ id: item.id, name: item.name, qty: 1 });
    }

    if (missingComponent) {
      skipped.push({
        title: page.title,
        reason: `component not in price API: ${missingComponent}`,
      });
      continue;
    }

    sets.push({
      type: "set",
      name: setItem.name,
      set: { id: setItem.id, name: setItem.name },
      components,
      wikiPage: page.title,
    });
  }

  sets.sort((a, b) => a.name.localeCompare(b.name));
  return { sets, skipped };
}

function buildUncharges(mapping) {
  const byName = buildNameLookup(mapping);
  const uncharges = [];

  for (const item of mapping) {
    if (!item.name.endsWith(" (uncharged)")) continue;
    const chargedName = item.name.replace(/ \(uncharged\)$/, "");
    const charged = mapItem(byName, chargedName);
    if (!charged) continue;

    uncharges.push({
      type: "uncharge",
      name: charged.name,
      charged: { id: charged.id, name: charged.name },
      uncharged: { id: item.id, name: item.name },
    });
  }

  for (const item of mapping) {
    const fullMatch = item.name.match(/^(.+) \(full\)$/);
    if (!fullMatch) continue;
    const empty = mapItem(byName, fullMatch[1]);
    if (!empty) continue;
    if (uncharges.some((u) => u.charged.id === item.id)) continue;

    uncharges.push({
      type: "uncharge",
      name: item.name,
      charged: { id: item.id, name: item.name },
      uncharged: { id: empty.id, name: empty.name },
    });
  }

  uncharges.sort((a, b) => a.name.localeCompare(b.name));
  return uncharges;
}

async function main() {
  console.log("Fetching price API mapping…");
  const mapping = await fetchJson(PRICE_API);

  console.log("Fetching wiki Recipe bucket…");
  const bucketRows = await fetchAllBucketRecipes();
  console.log(`  ${bucketRows.length} total bucket rows`);

  const { recipes: skilling, skipped: skillingSkipped, skills } = buildSkillingRecipes(
    bucketRows,
    mapping
  );

  console.log("Fetching wiki item set pages…");
  const setPages = await fetchCategorySetPages();
  console.log(`  ${setPages.length} set pages`);

  console.log("Fetching wiki Components tables…");
  const wikitextByTitle = await fetchWikitextBatch(setPages.map((p) => p.title));

  const decants = buildDecants(mapping);
  const { sets, skipped: setsSkipped } = buildSets(mapping, setPages, wikitextByTitle);
  const uncharges = buildUncharges(mapping);

  const catalog = {
    generatedAt: new Date().toISOString(),
    sources: {
      prices: PRICE_API,
      skilling: "Wiki Bucket:Recipe (production_json)",
      wikiSets: "Category:Item_sets (Components / CostLine tables)",
      decants: "Price API items with doses (1)–(4)",
      uncharges: "Price API charged ↔ uncharged / (full) pairs",
    },
    stats: {
      skilling: skilling.length,
      decants: decants.length,
      sets: sets.length,
      uncharges: uncharges.length,
      bucketRows: bucketRows.length,
      skillingSkipped: skillingSkipped.length,
      setsSkipped: setsSkipped.length,
      skills,
    },
    skilling,
    decants,
    sets,
    uncharges,
    skillingSkippedSample: skillingSkipped.slice(0, 50),
    setsSkipped,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(catalog, null, 2) + "\n");

  console.log("\nWrote", OUT_PATH);
  console.log(`  ${skilling.length} skilling recipes (${skills.length} skills)`);
  console.log(`  ${decants.length} decant groups`);
  console.log(`  ${sets.length} GE item sets`);
  console.log(`  ${uncharges.length} charge/uncharge pairs`);
  if (skillingSkipped.length) {
    console.log(`  ${skillingSkipped.length} skilling rows skipped`);
  }
  if (setsSkipped.length) {
    console.log(`  ${setsSkipped.length} sets skipped`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
