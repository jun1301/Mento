import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedIp,
  normalizeIp,
  parseNetwork,
  resolveClientIp,
  getDevelopmentAccessUrl,
} from "../lib/network.mjs";

test("development localhost pages use an allowed local interface without weakening IP checks", () => {
  const options = {
    enabled: true,
    clientIp: "127.0.0.1",
    host: "localhost:3001",
    networks: ["172.28.10.29"],
    localAddresses: ["172.28.10.29"],
    pathname: "/attendance",
  };
  assert.equal(
    getDevelopmentAccessUrl(options),
    "http://172.28.10.29:3001/attendance",
  );
  assert.equal(getDevelopmentAccessUrl({ ...options, enabled: false }), null);
  assert.equal(
    getDevelopmentAccessUrl({ ...options, clientIp: "172.28.10.30" }),
    null,
  );
  assert.equal(getDevelopmentAccessUrl({ ...options, clientIp: null }), null);
  assert.equal(
    getDevelopmentAccessUrl({ ...options, host: "outside.example:3001" }),
    null,
  );
  assert.equal(
    getDevelopmentAccessUrl({ ...options, localAddresses: ["172.28.10.30"] }),
    null,
  );
  assert.equal(getDevelopmentAccessUrl({ ...options, networks: [] }), null);
  assert.equal(isAllowedIp("127.0.0.1", options.networks), false);
});

test("exact IP, IPv4/IPv6 CIDR and IPv4-mapped IPv6", () => {
  assert.equal(isAllowedIp("203.0.113.10", ["203.0.113.10"]), true);
  assert.equal(isAllowedIp("203.0.113.11", ["203.0.113.10"]), false);
  assert.equal(isAllowedIp("192.168.10.254", ["192.168.10.0/24"]), true);
  assert.equal(isAllowedIp("192.168.11.1", ["192.168.10.0/24"]), false);
  assert.equal(isAllowedIp("2001:db8::42", ["2001:db8::/32"]), true);
  assert.equal(isAllowedIp("::ffff:203.0.113.10", ["203.0.113.10"]), true);
  assert.equal(isAllowedIp("::1", ["127.0.0.1"]), false);
});

test("empty/invalid configuration fails closed", () => {
  assert.equal(isAllowedIp("127.0.0.1", []), false);
  assert.equal(isAllowedIp(null, ["127.0.0.1"]), false);
  for (const bad of [
    "127.1",
    "example.com",
    "192.168.1.1/33",
    "::/129",
    "127.0.0.1/",
    "::ffff:127.0.0.1/128",
  ]) {
    assert.equal(isAllowedIp("127.0.0.1", ["127.0.0.1", bad]), false);
    assert.throws(() => parseNetwork(bad));
  }
  assert.equal(normalizeIp("127.0.0.1:3000"), null);
});

test("untrusted clients cannot forge X-Forwarded-For", () => {
  assert.equal(
    resolveClientIp("198.51.100.5", "203.0.113.10", []),
    "198.51.100.5",
  );
  assert.equal(
    resolveClientIp("198.51.100.5", "203.0.113.10", ["127.0.0.1"]),
    "198.51.100.5",
  );
});

test("trusted proxy chain stops at the first untrusted hop", () => {
  const proxies = ["127.0.0.1", "10.0.0.0/24"];
  assert.equal(
    resolveClientIp("127.0.0.1", "203.0.113.10, 10.0.0.2", proxies),
    "203.0.113.10",
  );
  assert.equal(
    resolveClientIp("127.0.0.1", "203.0.113.10, 198.51.100.5", proxies),
    "198.51.100.5",
  );
  assert.equal(resolveClientIp("127.0.0.1", "bad-value", proxies), null);
  assert.equal(resolveClientIp("127.0.0.1", undefined, proxies), null);
});
