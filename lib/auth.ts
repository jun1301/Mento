import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase, verifyPassword } from "./database.mjs";

const COOKIE = "dorm_session";
const SESSION_SECONDS = 60 * 60 * 12;
export type Student = { id: string; name: string };
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function getCurrentUser(): Promise<Student | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const user = getDatabase()
    .prepare(
      `SELECT users.id, users.name FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ? AND (users.is_demo = 0 OR ? = 1)`,
    )
    .get(
      digest(token),
      Date.now(),
      process.env.NODE_ENV === "development" ? 1 : 0,
    ) as Student | undefined;
  return user ? { id: user.id, name: user.name } : null;
}

export function authenticate(id: string, password: string) {
  const db = getDatabase();
  const now = Date.now();
  db.prepare("DELETE FROM login_attempts WHERE resets_at <= ?").run(now);
  const key = digest(id.toLowerCase());
  const attempts = db
    .prepare("SELECT attempts FROM login_attempts WHERE id = ?")
    .get(key) as { attempts: number } | undefined;
  if (attempts && attempts.attempts >= 5) return { limited: true, user: null };
  const user = db
    .prepare("SELECT id, name, password_hash, is_demo FROM users WHERE id = ?")
    .get(id) as
    | (Student & { password_hash: string; is_demo: number })
    | undefined;
  const valid = verifyPassword(
    password,
    user?.password_hash || `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  if (
    !user ||
    !valid ||
    (user.is_demo && process.env.NODE_ENV !== "development")
  ) {
    db.prepare(
      `INSERT INTO login_attempts (id, attempts, resets_at) VALUES (?, 1, ?)
      ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1`,
    ).run(key, now + 15 * 60 * 1000);
    return { limited: false, user: null };
  }
  db.prepare("DELETE FROM login_attempts WHERE id = ?").run(key);
  return { limited: false, user: { id: user.id, name: user.name } };
}

export async function createSession(userId: string) {
  const db = getDatabase();
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  if (previous)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      digest(previous),
    );
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(digest(token), userId, Date.now() + SESSION_SECONDS * 1000);
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function deleteSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    getDatabase()
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(digest(token));
  jar.delete(COOKIE);
}
