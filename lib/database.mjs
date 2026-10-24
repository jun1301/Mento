import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** @type {DatabaseSync | undefined} */
let database;

/** @param {string} password */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** @param {string} password @param {string} stored */
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}

export function getDatabase() {
  if (database) return database;
  const file = resolve(
    /* turbopackIgnore: true */ process.env.DORM_DB_PATH || "data/dorm.sqlite",
  );
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  database = new DatabaseSync(file);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL, checked_in_at TEXT NOT NULL, ip TEXT NOT NULL,
      UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  if (process.env.NODE_ENV === "development") {
    const existing = database
      .prepare("SELECT id FROM users WHERE id = ?")
      .get("student");
    if (!existing)
      database
        .prepare(
          "INSERT OR IGNORE INTO users (id, name, password_hash, is_demo) VALUES (?, ?, ?, 1)",
        )
        .run("student", "테스트 학생", hashPassword("dorm1234!"));
  }
  return database;
}
