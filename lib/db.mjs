import { neon } from "@neondatabase/serverless";

let _sql;

export function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function ensureSchema() {
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
}

export async function upsertDiscordUser(user) {
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

export async function getUserByDiscordId(discordId) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT id, discord_id, username, email, avatar, pro_until FROM users WHERE discord_id = ${discordId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function extendProByEmail(email, days = 32) {
  if (!email) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE users
    SET pro_until = GREATEST(COALESCE(pro_until, NOW()), NOW()) + (${String(days)} || ' days')::interval,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(${email})
    RETURNING id, discord_id, username, email, pro_until
  `;
  return rows[0] ?? null;
}

export async function recordKofiEvent(event) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO kofi_events (kofi_transaction_id, email, amount, tier_name, event_type, raw)
    VALUES (${event.transactionId}, ${event.email}, ${event.amount}, ${event.tierName}, ${event.type}, ${JSON.stringify(event.raw)}::jsonb)
    ON CONFLICT (kofi_transaction_id) DO NOTHING
  `;
}
