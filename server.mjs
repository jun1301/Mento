import { createServer } from "node:http";
import { createServer as createPortProbe } from "node:net";
import { createHmac, randomBytes } from "node:crypto";
import next from "next";
import nextEnv from "@next/env";
import { parseNetwork, resolveClientIp } from "./lib/network.mjs";

const dev = process.argv.includes("--dev");
process.env.NODE_ENV ||= dev ? "development" : "production";
nextEnv.loadEnvConfig(process.cwd(), dev);
const hostname = process.env.HOSTNAME_BIND || "0.0.0.0";
async function findPort(candidate) {
  const available = await new Promise((resolve, reject) => {
    const probe = createPortProbe();
    probe.once("error", (error) =>
      error.code === "EADDRINUSE" ? resolve(false) : reject(error),
    );
    probe.listen(candidate, hostname, () => probe.close(() => resolve(true)));
  });
  if (available) return candidate;
  if (!dev || process.env.PORT || candidate >= 3010)
    throw new Error(`Port ${candidate} is already in use`);
  return findPort(candidate + 1);
}
const port = await findPort(Number(process.env.PORT || 3000));
const trustedProxies = (process.env.TRUSTED_PROXY_CIDRS || "")
  .split(/[\s,]+/)
  .filter(Boolean);
trustedProxies.forEach(parseNetwork);
process.env.DORM_IP_HEADER_SECRET = randomBytes(32).toString("hex");
const app = next({ dev, hostname, port });
await app.prepare();
const handler = app.getRequestHandler();
const server = createServer((request, response) => {
  const ip =
    resolveClientIp(
      request.socket.remoteAddress,
      request.headers["x-forwarded-for"],
      trustedProxies,
    ) || "";
  request.headers["x-dorm-client-ip"] = ip;
  request.headers["x-dorm-ip-signature"] = createHmac(
    "sha256",
    process.env.DORM_IP_HEADER_SECRET,
  )
    .update(ip)
    .digest("hex");
  handler(request, response).catch((error) => {
    console.error("Request failed", error);
    if (!response.headersSent) response.writeHead(500);
    response.end("서버 오류가 발생했습니다.");
  });
});
server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
server.listen(port, hostname, () =>
  console.log(`기숙사 출석체크 ready: http://localhost:${port}`),
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close();
    server.closeAllConnections();
    const timeout = setTimeout(() => process.exit(0), 5000);
    timeout.unref();
    void app.close().finally(() => process.exit(0));
  });
}
