import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crave — Kulinarische Intelligenz",
    short_name: "Crave",
    description: "KI-gestützte Rezeptideen für jeden Appetit.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFBF6",
    theme_color: "#D7C56D",
    lang: "de",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
