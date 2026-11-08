import postgres from 'postgres';

// Tabellen werden beim ersten Aufruf automatisch angelegt – du musst nichts in der Datenbank einrichten.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS channels (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id                  SERIAL PRIMARY KEY,
  channel_id          INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  external_id         TEXT NOT NULL,
  username            TEXT,
  display_name        TEXT,
  avatar_url          TEXT,
  profile_url         TEXT,
  followers           BIGINT,
  access_token        TEXT,
  refresh_token       TEXT,
  token_expires_at    TIMESTAMPTZ,
  refresh_expires_at  TIMESTAMPTZ,
  last_synced_at      TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS videos (
  id                BIGSERIAL PRIMARY KEY,
  profile_id        INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  external_id       TEXT NOT NULL,
  title             TEXT,
  thumbnail_url     TEXT,
  url               TEXT,
  published_at      TIMESTAMPTZ,
  duration_sec      INT,
  views             BIGINT,
  likes             BIGINT,
  comments          BIGINT,
  shares            BIGINT,
  saves             BIGINT,
  stats_updated_at  TIMESTAMPTZ,
  UNIQUE (profile_id, external_id)
);
CREATE INDEX IF NOT EXISTS videos_published_idx ON videos (published_at DESC);

-- Ein Eintrag pro Account und Tag: Grundlage für den "täglichen Zuwachs"
CREATE TABLE IF NOT EXISTS profile_daily (
  profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  views       BIGINT NOT NULL DEFAULT 0,
  likes       BIGINT NOT NULL DEFAULT 0,
  comments    BIGINT NOT NULL DEFAULT 0,
  shares      BIGINT NOT NULL DEFAULT 0,
  followers   BIGINT,
  videos      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, day)
);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = postgres.Sql<any>;
const g = globalThis as unknown as { __sql?: Sql; __schema?: Promise<void> };

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function hasDatabase() {
  return databaseUrl() !== '';
}

export function db(): Sql {
  if (g.__sql) return g.__sql;
  const url = databaseUrl();
  if (!url) throw new Error('Keine Datenbank verbunden (DATABASE_URL fehlt) – siehe Anleitung, Schritt 3.');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  g.__sql = postgres(url, {
    ssl: local ? false : 'require',
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // nötig für den Verbindungs-Pooler von Neon
    onnotice: () => {}, // Hinweise wie "Tabelle existiert schon" nicht ins Log schreiben
    // BIGINT-Spalten als normale Zahlen zurückgeben (statt als Text)
    types: {
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
  return g.__sql;
}

export function ensureSchema(): Promise<void> {
  if (!g.__schema) {
    g.__schema = (async () => {
      const sql = db();
      try {
        await sql.unsafe(SCHEMA);
      } catch {
        // Falls zwei Anfragen gleichzeitig die Tabellen anlegen wollten: kurz warten, nochmal.
        await new Promise((r) => setTimeout(r, 500));
        await sql.unsafe(SCHEMA);
      }
    })().catch((e) => {
      g.__schema = undefined;
      throw e;
    });
  }
  return g.__schema;
}
