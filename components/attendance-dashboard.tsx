"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Student } from "@/lib/auth";
import type { AttendanceRecord, NetworkStatus } from "@/lib/attendance";
import SchoolMark from "./school-mark";

type DashboardData = {
  user: Student;
  today: string;
  records: AttendanceRecord[];
  network: NetworkStatus;
};

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const formatDate = (value: string, short = false) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(short ? {} : { year: "numeric" as const }),
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${value}T12:00:00+09:00`));

export default function AttendanceDashboard({
  initial,
}: {
  initial: DashboardData;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const todayRecord = data.records.find((record) => record.date === data.today);
  const allowed = data.network.status === "allowed";

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/attendance", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/");
        router.refresh();
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result);
      setError("");
    } catch {
      setError("상태를 불러오지 못했어요. 네트워크 연결을 확인해 주세요.");
    } finally {
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, 60_000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function submitAttendance() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/attendance", { method: "POST" });
      if (response.status === 401) {
        router.replace("/");
        router.refresh();
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        if (result.network)
          setData((previous) => ({ ...previous, network: result.network }));
        throw new Error(result.message || "출석을 저장하지 못했어요.");
      }
      setData((previous) => ({
        ...previous,
        today: result.today,
        records: result.records,
        network: result.network,
      }));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "연결을 확인하고 다시 시도해 주세요.",
      );
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="dashboard-page">
      <header className="app-header">
        <div className="header-inner">
          <a className="app-brand" href="/attendance">
            <SchoolMark size={38} />
            <span>기숙사 출석체크</span>
          </a>
          <div className="header-account">
            <span>
              <strong>{data.user.name}</strong>
            </span>
            <span className="header-divider" />
            <button
              className="text-button"
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut ? "로그아웃 중…" : "로그아웃"}
              <span aria-hidden="true"> ↗</span>
            </button>
          </div>
        </div>
      </header>
      <main className="dashboard-main">
        <section className="welcome-section">
          <h1>
            {data.user.name}님, 안녕하세요
            <span className="greeting-dot">.</span>
          </h1>
          <p className="welcome-description">
            오늘도 수고 많았어요. 기숙사 출석을 확인해 주세요.
          </p>
        </section>
        <div className="dashboard-grid">
          <section
            className={`attendance-card surface ${todayRecord ? "is-complete" : ""}`}
            aria-labelledby="check-in-title"
          >
            <div className="card-heading">
              <span>오늘의 출석</span>
              <span
                className={`status-pill ${todayRecord ? "complete" : "waiting"}`}
              >
                <span />
                {todayRecord ? "출석 완료" : "출석 대기"}
              </span>
            </div>
            <p className="today-date">{formatDate(data.today)}</p>
            <div className="check-in-content" aria-live="polite">
              <div className={`attendance-symbol ${todayRecord ? "done" : ""}`}>
                <CheckIcon />
              </div>
              <h2 id="check-in-title">
                {todayRecord
                  ? "오늘 출석을 완료했어요"
                  : "오늘의 출석을 체크해 주세요"}
              </h2>
              {!todayRecord && (
                <p>기숙사 네트워크에 연결하고 아래 버튼을 눌러 주세요.</p>
              )}
              {todayRecord && (
                <div className="completion-time">
                  <CheckIcon />
                  {formatTime(todayRecord.checkedInAt)} 출석 인정
                </div>
              )}
            </div>
            <div className={`network-panel ${allowed ? "connected" : ""}`}>
              <WifiIcon />
              <div>
                <strong>
                  {allowed
                    ? "기숙사 네트워크 연결됨"
                    : data.network.status === "unconfigured" ||
                        data.network.status === "invalid"
                      ? "출석 네트워크 준비 중"
                      : "기숙사 네트워크 확인 필요"}
                </strong>
                {!allowed && <p>{data.network.message}</p>}
              </div>
              <button
                className={`refresh-button ${refreshing ? "spinning" : ""}`}
                onClick={refresh}
                disabled={refreshing || pending}
                aria-label="네트워크 다시 확인"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <button
              className="primary-button attendance-button"
              onClick={submitAttendance}
              disabled={pending || refreshing || !!todayRecord || !allowed}
            >
              {pending ? (
                <>
                  <span className="spinner" /> 출석 확인 중…
                </>
              ) : todayRecord ? (
                <>
                  <CheckIcon /> 출석 완료
                </>
              ) : (
                "기숙사 출석체크"
              )}
            </button>
            {!todayRecord && (
              <p className="check-in-footnote">
                출석은 하루에 한 번, 현재 접속한 네트워크에서 확인해요.
              </p>
            )}
            {error && (
              <p className="dashboard-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <aside className="dashboard-aside">
            <section className="guide-card surface">
              <div className="section-label">
                <span className="small-icon">i</span>
                <h2>출석 안내</h2>
              </div>
              <ol className="guide-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>기숙사 Wi-Fi 연결</strong>
                    <p>지정된 기숙사 네트워크에 연결해 주세요.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>출석체크 버튼 누르기</strong>
                    <p>버튼을 누르면 오늘의 출석이 기록돼요.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>출석 완료 확인</strong>
                    <p>완료 표시와 출석 시간을 확인해 주세요.</p>
                  </div>
                </li>
              </ol>
            </section>
          </aside>
          <section
            className="history-card surface"
            aria-labelledby="history-title"
          >
            <div className="history-heading">
              <h2 id="history-title">최근 출석 내역</h2>
              <span>최근 7회</span>
            </div>
            {data.records.length ? (
              <ul className="history-list">
                {data.records.map((record) => (
                  <li key={record.date}>
                    <div className="history-check">
                      <CheckIcon />
                    </div>
                    <div className="history-date">
                      <strong>{formatDate(record.date, true)}</strong>
                      <span>
                        {record.date === data.today ? "오늘" : "기숙사 출석"}
                      </span>
                    </div>
                    <time dateTime={record.checkedInAt}>
                      {formatTime(record.checkedInAt)}
                    </time>
                    <span className="history-badge">출석</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-history">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="4"
                    y="5"
                    width="16"
                    height="16"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 3v4m8-4v4M4 11h16m-12 4h3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <strong>아직 출석 기록이 없어요</strong>
                <p>첫 출석을 완료하면 이곳에서 확인할 수 있어요.</p>
              </div>
            )}
          </section>
        </div>
        <footer className="dashboard-footer">
          경북소프트웨어마이스터고등학교
          <span />
          기숙사 출석체크
        </footer>
      </main>
    </div>
  );
}
