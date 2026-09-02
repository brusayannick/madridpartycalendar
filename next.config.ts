import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray package-lock.json in a parent dir
  // is not mistaken for the project root.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      // PATT event images (tickets.nightlifemadrid.com + events.patt.club).
      { protocol: "https", hostname: "everywherestorage.blob.core.windows.net" },
      // erasmusmadrid.org WordPress uploads.
      { protocol: "https", hostname: "erasmusmadrid.org" },
    ],
  },
};

export default nextConfig;
