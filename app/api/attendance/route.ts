import { getCurrentUser } from "@/lib/auth";
import {
  checkIn,
  getNetworkStatus,
  getRecords,
  getToday,
  getVerifiedClientIp,
} from "@/lib/attendance";
import { isSameOrigin, json } from "@/lib/http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ message: "로그인이 필요합니다." }, 401);
  return json({
    user,
    today: getToday(),
    records: getRecords(user.id),
    network: getNetworkStatus(request.headers),
  });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return json({ message: "허용되지 않은 요청입니다." }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ message: "로그인이 필요합니다." }, 401);
  const network = getNetworkStatus(request.headers);
  if (network.status !== "allowed")
    return json({ message: network.message, network }, 403);
  const ip = getVerifiedClientIp(request.headers);
  if (!ip) return json({ message: "접속 네트워크를 확인할 수 없습니다." }, 403);
  return json({
    ...checkIn(user.id, ip),
    today: getToday(),
    records: getRecords(user.id),
    network,
  });
}
