import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { getAllowedNetworks } from "./config/attendance";
import { isAllowedIp } from "./lib/network.mjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: Object.values(networkInterfaces())
    .flatMap((entries) => entries?.map((entry) => entry.address) || [])
    .filter((address) => isAllowedIp(address, getAllowedNetworks())),
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
