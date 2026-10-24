"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ showDemo }: { showDemo: boolean }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "로그인에 실패했습니다.");
      router.replace("/attendance");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "연결을 확인하고 다시 시도해 주세요.",
      );
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={login}>
      <div className="line-field">
        <label className="sr-only" htmlFor="student-id">
          아이디
        </label>
        <input
          id="student-id"
          name="username"
          placeholder="아이디"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={50}
          value={id}
          onChange={(event) => setId(event.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="line-field password-field">
        <label className="sr-only" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          placeholder="비밀번호"
          autoComplete="current-password"
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={pending}
        />
        {password && (
          <button
            className="password-toggle"
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
          >
            {visible ? "숨기기" : "보기"}
          </button>
        )}
      </div>
      <div className="login-error" aria-live="polite">
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        className="primary-button login-button"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <>
            <span className="spinner" /> 로그인 중
          </>
        ) : (
          "로그인"
        )}
      </button>
      {showDemo && (
        <div className="demo-account">
          <span>테스트 계정</span>
          <code>student / dorm1234!</code>
          <button
            type="button"
            onClick={() => {
              setId("student");
              setPassword("dorm1234!");
              setError("");
            }}
            disabled={pending}
          >
            입력하기 <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </form>
  );
}
