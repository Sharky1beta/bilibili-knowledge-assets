import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "knowledge-clip-studio.sqlite");

export function getDb() {
  if (!db) {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    ensureSchema(db);
  }

  return db;
}

function ensureSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      aid INTEGER,
      bvid TEXT,
      cid INTEGER,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      owner_name TEXT,
      duration INTEGER,
      cover_url TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      page_count INTEGER,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      start_sec REAL NOT NULL,
      end_sec REAL NOT NULL,
      text TEXT NOT NULL,
      summary TEXT,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS frames (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      timestamp_sec REAL NOT NULL,
      image_path TEXT NOT NULL,
      summary TEXT NOT NULL,
      visible_text_json TEXT NOT NULL,
      visual_type TEXT NOT NULL,
      information_density REAL NOT NULL,
      retention_reason TEXT NOT NULL,
      only_in_visual_json TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      source_segment_ids_json TEXT NOT NULL,
      source_frame_ids_json TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      asset_ids_json TEXT NOT NULL,
      prompt TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_segments_asset_id ON segments(asset_id);
    CREATE INDEX IF NOT EXISTS idx_frames_asset_id ON frames(asset_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_asset_id ON knowledge_items(asset_id);
  `);

  ensureColumn(database, "assets", "aid", "INTEGER");
  ensureColumn(database, "assets", "cid", "INTEGER");
  ensureColumn(database, "assets", "tags_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, "assets", "page_count", "INTEGER");
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const exists = rows.some((row) => row.name === column);

  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
