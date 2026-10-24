import "server-only";
import { networkInterfaces } from "node:os";
import { getAllowedNetworks } from "@/config/attendance";
import { getVerifiedClientIp } from "./attendance";
import { getDevelopmentAccessUrl } from "./network.mjs";

export function getLocalNetworkRedirect(headers: Headers, pathname: string) {
  return getDevelopmentAccessUrl({
    enabled: process.env.NODE_ENV === "development" && !process.env.APP_ORIGIN,
    clientIp: getVerifiedClientIp(headers),
    host: headers.get("host"),
    pathname,
    networks: getAllowedNetworks(),
    localAddresses: Object.values(networkInterfaces()).flatMap(
      (entries) =>
        entries
          ?.filter((entry) => !entry.internal)
          .map((entry) => entry.address) || [],
    ),
  });
}
