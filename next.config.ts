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
      // Whan event images.
      { protocol: "https", hostname: "app.whan.es" },
      // EventUpp (ESN UPM) event images.
      { protocol: "https", hostname: "api.eventupp.eu" },
      // Fourvenues (Erasmus Touch) event images.
      { protocol: "https", hostname: "fourvenues.com" },
      { protocol: "https", hostname: "d72sklgi05fbu.cloudfront.net" },
    ],
  },
};

export default nextConfig;
