import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type PersonRow = {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  death_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type RelationshipRow = {
  id: number;
  parent_id: number;
  child_id: number;
  type: string;
  created_at: string;
};

export function openDatabase(dbPath = process.env.GENEALOGY_DB_PATH ?? 'data/genealogy.sqlite') {
  const resolvedPath = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma('foreign_keys = ON');
  migrate(db);

  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      birth_date TEXT,
      death_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (length(trim(first_name)) > 0 OR length(trim(last_name)) > 0)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'parent',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES persons(id) ON DELETE CASCADE,
      CHECK (parent_id <> child_id),
      UNIQUE (parent_id, child_id, type)
    );
  `);
}
