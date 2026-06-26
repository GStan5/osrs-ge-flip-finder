const { neon } = require("@neondatabase/serverless");

let _sql;

function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT,
      email TEXT,
      avatar TEXT,
      pro_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS kofi_events (
      id SERIAL PRIMARY KEY,
      kofi_transaction_id TEXT UNIQUE,
      email TEXT,
      amount TEXT,
      tier_name TEXT,
      event_type TEXT,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_sync (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sync_key TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT 'null',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, sync_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      direction TEXT NOT NULL,
      target_price INTEGER NOT NULL,
      webhook_url TEXT NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      last_triggered TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS flip_aggregate_daily (
      day DATE NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      flip_count INTEGER DEFAULT 0,
      total_profit BIGINT DEFAULT 0,
      PRIMARY KEY (day, item_name)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT 'null',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

async function upsertDiscordUser(user) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (discord_id, username, email, avatar, updated_at)
    VALUES (${user.discordId}, ${user.username}, ${user.email}, ${user.avatar}, NOW())
    ON CONFLICT (discord_id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      avatar = EXCLUDED.avatar,
      updated_at = NOW()
    RETURNING id, discord_id, username, email, avatar, pro_until
  `;
  return rows[0];
}

async function getUserByDiscordId(discordId) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, discord_id, username, email, avatar, pro_until
    FROM users WHERE discord_id = ${discordId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function extendProByEmail(email, days = 32) {
  if (!email) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE users
    SET pro_until = GREATEST(COALESCE(pro_until, NOW()), NOW()) + INTERVAL '32 days',
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(${email})
    RETURNING id, discord_id, username, email, pro_until
  `;
  return rows[0] ?? null;
}

async function recordKofiEvent(event) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO kofi_events (kofi_transaction_id, email, amount, tier_name, event_type, raw)
    VALUES (
      ${event.transactionId},
      ${event.email},
      ${event.amount},
      ${event.tierName},
      ${event.type},
      ${JSON.stringify(event.raw)}::jsonb
    )
    ON CONFLICT (kofi_transaction_id) DO NOTHING
  `;
}

async function getRecentKofiEvents(limit = 5) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT kofi_transaction_id, email, amount, tier_name, event_type, created_at
    FROM kofi_events
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

async function getUserSyncData(userId) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT sync_key, data, updated_at FROM user_sync WHERE user_id = ${userId}
  `;
  const out = {};
  for (const row of rows) {
    out[row.sync_key] = { data: row.data, updatedAt: row.updated_at };
  }
  return out;
}

async function upsertUserSyncData(userId, syncKey, data) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO user_sync (user_id, sync_key, data, updated_at)
    VALUES (${userId}, ${syncKey}, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (user_id, sync_key) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW()
  `;
}

async function getUserAlerts(userId) {
  await ensureSchema();
  const sql = getSql();
  return sql`
    SELECT id, item_id, item_name, direction, target_price, webhook_url, active, last_triggered, created_at
    FROM price_alerts WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
}

async function createAlert(userId, alert) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO price_alerts (user_id, item_id, item_name, direction, target_price, webhook_url)
    VALUES (${userId}, ${alert.itemId}, ${alert.itemName}, ${alert.direction}, ${alert.targetPrice}, ${alert.webhookUrl})
    RETURNING id, item_id, item_name, direction, target_price, webhook_url, active, created_at
  `;
  return rows[0];
}

async function deleteAlert(userId, alertId) {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM price_alerts WHERE user_id = ${userId} AND id = ${alertId}`;
}

async function getActiveAlerts() {
  await ensureSchema();
  const sql = getSql();
  return sql`
    SELECT a.id, a.user_id, a.item_id, a.item_name, a.direction, a.target_price, a.webhook_url, a.last_triggered
    FROM price_alerts a WHERE a.active = TRUE
  `;
}

async function markAlertTriggered(alertId) {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE price_alerts SET last_triggered = NOW() WHERE id = ${alertId}`;
}

async function recordFlipAggregate(itemName, itemId, profit) {
  await ensureSchema();
  const sql = getSql();
  const day = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO flip_aggregate_daily (day, item_id, item_name, flip_count, total_profit)
    VALUES (${day}, ${itemId ?? null}, ${itemName}, 1, ${Math.round(profit || 0)})
    ON CONFLICT (day, item_name) DO UPDATE SET
      flip_count = flip_aggregate_daily.flip_count + 1,
      total_profit = flip_aggregate_daily.total_profit + EXCLUDED.total_profit,
      item_id = COALESCE(EXCLUDED.item_id, flip_aggregate_daily.item_id)
  `;
}

async function getTopFlipAggregates(days = 7, limit = 20) {
  await ensureSchema();
  const sql = getSql();
  return sql`
    SELECT item_name, item_id,
      SUM(flip_count)::int AS flip_count,
      SUM(total_profit)::bigint AS total_profit
    FROM flip_aggregate_daily
    WHERE day >= CURRENT_DATE - ${days}::int
    GROUP BY item_name, item_id
    ORDER BY SUM(total_profit) DESC
    LIMIT ${limit}
  `;
}

async function recordCronRun(job, result = {}) {
  if (!process.env.DATABASE_URL) return null;
  await ensureSchema();
  const sql = getSql();
  const payload = { ...result, at: new Date().toISOString() };
  await sql`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES (${job}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `;
  return payload;
}

async function getCronRun(job) {
  if (!process.env.DATABASE_URL) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT value, updated_at FROM app_meta WHERE key = ${job} LIMIT 1
  `;
  if (!rows[0]) return null;
  return { ...rows[0].value, updatedAt: rows[0].updated_at };
}

module.exports = {
  upsertDiscordUser,
  getUserByDiscordId,
  extendProByEmail,
  recordKofiEvent,
  getRecentKofiEvents,
  getUserSyncData,
  upsertUserSyncData,
  getUserAlerts,
  createAlert,
  deleteAlert,
  getActiveAlerts,
  markAlertTriggered,
  recordFlipAggregate,
  getTopFlipAggregates,
  recordCronRun,
  getCronRun,
};
