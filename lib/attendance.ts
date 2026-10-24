import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { attendanceConfig, getAllowedNetworks } from "@/config/attendance";
import { getDatabase } from "./database.mjs";
import { isAllowedIp, normalizeIp, parseNetwork } from "./network.mjs";

export type AttendanceRecord = { date: string; checkedInAt: string };
export type NetworkStatus = {
  status: "unconfigured" | "invalid" | "unavailable" | "allowed" | "blocked";
  message: string;
};

export function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: attendanceConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getVerifiedClientIp(headers: Headers) {
  const secret = process.env.DORM_IP_HEADER_SECRET;
  const ip = headers.get("x-dorm-client-ip") || "";
  const signature = headers.get("x-dorm-ip-signature") || "";
  if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = createHmac("sha256", secret).update(ip).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  return normalizeIp(ip);
}

export function getNetworkStatus(headers: Headers): NetworkStatus {
  const networks = getAllowedNetworks();
  if (!networks.length)
    return {
      status: "unconfigured",
      message: "출석 네트워크를 준비하고 있어요. 담당 선생님께 문의해 주세요.",
    };
  try {
    networks.forEach(parseNetwork);
  } catch {
    return {
      status: "invalid",
      message:
        "출석 네트워크 설정을 확인하고 있어요. 담당 선생님께 문의해 주세요.",
    };
  }
  const ip = getVerifiedClientIp(headers);
  if (!ip)
    return {
      status: "unavailable",
      message: "접속 네트워크를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.",
    };
  return isAllowedIp(ip, networks)
    ? { status: "allowed", message: "기숙사 네트워크에 연결되어 있어요." }
    : {
        status: "blocked",
        message: "기숙사 Wi-Fi에 연결한 뒤 다시 확인해 주세요.",
      };
}

export function getRecords(userId: string): AttendanceRecord[] {
  const rows = getDatabase()
    .prepare(
      "SELECT date, checked_in_at AS checkedInAt FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 7",
    )
    .all(userId) as AttendanceRecord[];
  return rows.map((row) => ({ date: row.date, checkedInAt: row.checkedInAt }));
}

export function checkIn(userId: string, ip: string) {
  const today = getToday();
  const db = getDatabase();
  const result = db
    .prepare(
      "INSERT INTO attendance (user_id, date, checked_in_at, ip) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, date) DO NOTHING",
    )
    .run(userId, today, new Date().toISOString(), ip);
  const record = db
    .prepare(
      "SELECT date, checked_in_at AS checkedInAt FROM attendance WHERE user_id = ? AND date = ?",
    )
    .get(userId, today) as AttendanceRecord;
  return { record, alreadyCheckedIn: result.changes === 0 };
}
