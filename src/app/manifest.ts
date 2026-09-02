import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Madrid Party Calendar",
    short_name: "Madrid Parties",
    description:
      "Aggregated calendar of Madrid nightlife — club nights, pubcrawls and pool parties.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0b14",
    theme_color: "#0d0b14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
