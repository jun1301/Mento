import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

test(
  "authentication, server-side IP enforcement, persistence and duplicate prevention",
  { timeout: 90_000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "dorm-test-"));
    const env = {
      ...process.env,
      NODE_ENV: "production",
      DORM_DB_PATH: join(directory, "test.sqlite"),
      TRUSTED_PROXY_CIDRS: "",
      APP_ORIGIN: "",
      HOSTNAME_BIND: "127.0.0.1",
    };
    delete env.DORM_IP_HEADER_SECRET;
    const create = spawnSync(
      process.execPath,
      ["scripts/create-user.mjs", "teststudent", "출석 테스트"],
      { env, input: "test-password-123!\n", encoding: "utf8" },
    );
    assert.equal(create.status, 0, create.stderr);
    let child;
    let base;
    let cookie;

    async function stop() {
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }
    }
    async function start(networks) {
      const probe = createServer();
      probe.listen(0, "127.0.0.1");
      await once(probe, "listening");
      const port = probe.address().port;
      await new Promise((resolve) => probe.close(resolve));
      base = `http://127.0.0.1:${port}`;
      let output = "";
      child = spawn(process.execPath, ["server.mjs"], {
        env: { ...env, PORT: String(port), ATTENDANCE_ALLOWED_IPS: networks },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) throw new Error(output);
        try {
          if ((await fetch(base)).status === 200) return;
        } catch {}
        await delay(100);
      }
      throw new Error(`Server readiness timed out: ${output}`);
    }
    async function request(
      path,
      { method = "GET", body, headers = {}, authenticated = true } = {},
    ) {
      const response = await fetch(base + path, {
        method,
        redirect: "manual",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          ...(authenticated && cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      return { response, data };
    }
    async function login() {
      const { response } = await request("/api/auth/login", {
        method: "POST",
        authenticated: false,
        body: { id: "teststudent", password: "test-password-123!" },
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
      assert.match(response.headers.get("set-cookie"), /Secure/i);
      cookie = response.headers.get("set-cookie").split(";")[0];
    }

    try {
      await start("127.0.0.1");
      await t.test(
        "unauthenticated and cross-origin requests fail",
        async () => {
          assert.equal((await request("/api/attendance")).response.status, 401);
          assert.equal(
            (
              await request("/api/attendance", {
                method: "POST",
                headers: { Origin: "https://outside.example" },
              })
            ).response.status,
            403,
          );
          assert.equal(
            (
              await request("/api/auth/login", {
                method: "POST",
                body: { id: "teststudent", password: "incorrect" },
              })
            ).response.status,
            401,
          );
          assert.equal(
            (
              await request("/api/auth/login", {
                method: "POST",
                body: { id: "student", password: "dorm1234!" },
              })
            ).response.status,
            401,
          );
        },
      );
      await login();
      await t.test(
        "actual socket address is used and concurrent submissions save one record",
        async () => {
          const state = await request("/api/attendance", {
            headers: {
              "X-Forwarded-For": "198.51.100.1",
              "X-Dorm-Client-Ip": "198.51.100.1",
              "X-Dorm-Ip-Signature": "0".repeat(64),
            },
          });
          assert.equal(state.data.network.status, "allowed");
          const results = await Promise.all(
            Array.from({ length: 5 }, () =>
              request("/api/attendance", { method: "POST" }),
            ),
          );
          assert.ok(results.every((item) => item.response.status === 200));
          assert.equal(
            results.filter((item) => !item.data.alreadyCheckedIn).length,
            1,
          );
          assert.ok(results.every((item) => item.data.records.length === 1));
        },
      );
      await t.test("logout revokes the server session", async () => {
        assert.equal(
          (await request("/api/auth/logout", { method: "POST" })).response
            .status,
          200,
        );
        assert.equal((await request("/api/attendance")).response.status, 401);
      });
      await stop();
      for (const [networks, expected] of [
        ["203.0.113.10", "blocked"],
        ["", "unconfigured"],
        ["127.0.0.1,broken", "invalid"],
      ]) {
        await start(networks);
        await login();
        await t.test(
          `${expected} network blocks check-in even with forged headers; records survive restart`,
          async () => {
            const state = await request("/api/attendance");
            assert.equal(state.data.network.status, expected);
            assert.equal(state.data.records.length, 1);
            const denied = await request("/api/attendance", {
              method: "POST",
              headers: {
                "X-Forwarded-For": "203.0.113.10",
                "X-Dorm-Client-Ip": "203.0.113.10",
                "X-Dorm-Ip-Signature": "0".repeat(64),
              },
            });
            assert.equal(denied.response.status, 403);
          },
        );
        await stop();
      }
    } finally {
      await stop();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
