import { emitKeypressEvents } from "node:readline";
import nextEnv from "@next/env";
import { getDatabase, hashPassword } from "../lib/database.mjs";

nextEnv.loadEnvConfig(process.cwd());
const [id, name] = process.argv.slice(2);
if (
  !id ||
  !/^[a-zA-Z0-9_-]{1,50}$/.test(id) ||
  !name?.trim() ||
  name.length > 50
) {
  console.error('사용법: npm run user:add -- 20260001 "홍길동"');
  process.exit(1);
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    return input.replace(/\r?\n$/, "");
  }
  process.stdout.write("비밀번호 (8자 이상, 화면에 표시되지 않음): ");
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve) => {
    let password = "";
    const listener = (text, key) => {
      if (key?.ctrl && key.name === "c") {
        process.stdout.write("\n");
        process.exit(130);
      }
      if (key?.name === "return") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("keypress", listener);
        process.stdout.write("\n");
        resolve(password);
      } else if (key?.name === "backspace") password = password.slice(0, -1);
      else if (text && !key?.ctrl && !key?.meta) password += text;
    };
    process.stdin.on("keypress", listener);
  });
}

const password = await readPassword();
if (
  typeof password !== "string" ||
  password.length < 8 ||
  password.length > 256
) {
  console.error("비밀번호는 8~256자로 입력해 주세요.");
  process.exit(1);
}
const db = getDatabase();
if (db.prepare("SELECT id FROM users WHERE id = ?").get(id)) {
  console.error("이미 존재하는 아이디입니다.");
  process.exit(1);
}
db.prepare("INSERT INTO users (id, name, password_hash) VALUES (?, ?, ?)").run(
  id,
  name.trim(),
  hashPassword(password),
);
console.log(`학생 계정을 만들었습니다: ${id} (${name.trim()})`);
