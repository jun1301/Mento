import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getLocalNetworkRedirect } from "@/lib/development";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/login-form";
import SchoolMark from "@/components/school-mark";

export default async function Home() {
  const localUrl = getLocalNetworkRedirect(await headers(), "/");
  if (localUrl) redirect(localUrl);
  if (await getCurrentUser()) redirect("/attendance");
  return (
    <main className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <SchoolMark size={144} />
          <h1>기숙사 출석체크</h1>
        </div>
        <LoginForm showDemo={process.env.NODE_ENV === "development"} />
        <footer className="login-footer">
          <p>경북소프트웨어마이스터고등학교</p>
          <span>하루의 마무리, 간편한 출석체크</span>
        </footer>
      </div>
    </main>
  );
}
