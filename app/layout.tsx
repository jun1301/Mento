import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기숙사 출석체크 | 경북소프트웨어마이스터고등학교",
  description: "기숙사 네트워크에서 간편하게 확인하는 오늘의 출석",
  icons: { icon: "/school-mark.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
