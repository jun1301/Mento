import { deleteSession } from "@/lib/auth";
import { isSameOrigin, json } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return json({ message: "허용되지 않은 요청입니다." }, 403);
  await deleteSession();
  return json({ ok: true });
}
