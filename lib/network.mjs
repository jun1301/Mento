import ipaddr from "ipaddr.js";

/** @param {string | undefined | null} value */
export function normalizeIp(value) {
  try {
    if (!value || value.includes("%")) return null;
    if (
      !value.includes(":") &&
      !ipaddr.IPv4.isValidFourPartDecimal(value.trim())
    )
      return null;
    return ipaddr.process(value.trim()).toString();
  } catch {
    return null;
  }
}

/** @param {string} entry */
export function parseNetwork(entry) {
  const parts = entry.trim().split("/");
  if (parts.length > 2) throw new Error("Invalid network");
  const ip = normalizeIp(parts[0]);
  if (!ip) throw new Error("Invalid IP");
  const address = ipaddr.parse(ip);
  const max = address.kind() === "ipv4" ? 32 : 128;
  const prefix = parts.length === 1 ? max : Number(parts[1]);
  if (parts.length === 2 && !/^\d+$/.test(parts[1]))
    throw new Error("Invalid prefix");
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max)
    throw new Error("Invalid prefix");
  if (parts[0].includes(":") && address.kind() === "ipv4" && parts.length === 2)
    throw new Error("Use an IPv4 CIDR");
  return { address, prefix };
}

/** @param {string | null} ip @param {string[]} networks */
export function isAllowedIp(ip, networks) {
  try {
    const ranges = networks.map(parseNetwork);
    const normalized = normalizeIp(ip);
    if (!normalized) return false;
    const address = ipaddr.parse(normalized);
    return ranges.some(
      ({ address: range, prefix }) =>
        address.kind() === range.kind() && address.match(range, prefix),
    );
  } catch {
    return false;
  }
}

/**
 * Follow forwarding headers only for trusted socket peers, right to left.
 * @param {string | undefined} peer
 * @param {string | string[] | undefined} forwarded
 * @param {string[]} trustedProxies
 */
export function resolveClientIp(peer, forwarded, trustedProxies) {
  let current = normalizeIp(peer);
  if (!current || !isAllowedIp(current, trustedProxies)) return current;
  if (typeof forwarded !== "string" || !forwarded.trim()) return null;
  const chain = forwarded.split(",");
  if (chain.length > 32) return null;
  for (let index = chain.length - 1; index >= 0; index--) {
    if (!isAllowedIp(current, trustedProxies)) break;
    current = normalizeIp(chain[index].trim());
    if (!current) return null;
  }
  return current;
}

/**
 * Direct local browsers to an allowed LAN interface without bypassing IP checks.
 * @param {{ enabled: boolean, clientIp: string | null, host: string | null, networks: string[], localAddresses: string[], pathname: string }} options
 */
export function getDevelopmentAccessUrl(options) {
  if (
    !options.enabled ||
    !isAllowedIp(options.clientIp, ["127.0.0.0/8", "::1"]) ||
    !options.host
  )
    return null;
  try {
    const url = new URL(`http://${options.host}`);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return null;
    const target = options.localAddresses
      .map(normalizeIp)
      .find(
        (ip) =>
          ip &&
          !isAllowedIp(ip, ["127.0.0.0/8", "::1"]) &&
          isAllowedIp(ip, options.networks),
      );
    if (!target) return null;
    url.hostname = target.includes(":") ? `[${target}]` : target;
    url.pathname = options.pathname;
    return url.toString();
  } catch {
    return null;
  }
}
