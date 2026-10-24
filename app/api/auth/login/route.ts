import { authenticate, createSession } from "@/lib/auth";
import { isSameOrigin, json } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return json({ message: "허용되지 않은 요청입니다." }, 403);
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.id !== "string" ||
    typeof body.password !== "string" ||
    !body.id.trim() ||
    body.id.length > 50 ||
    !body.password ||
    body.password.length > 256
  )
    return json({ message: "아이디와 비밀번호를 확인해 주세요." }, 400);
  const { user, limited } = authenticate(body.id.trim(), body.password);
  if (limited)
    return json(
      { message: "로그인 시도가 많습니다. 15분 후 다시 시도해 주세요." },
      429,
    );
  if (!user)
    return json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
  await createSession(user.id);
  return json({ user });
}
