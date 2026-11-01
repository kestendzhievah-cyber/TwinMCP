import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TwinMCP — MCPs as a Service",
    short_name: "TwinMCP",
    description:
      "Run your Model Context Protocol servers in isolated runtimes. Connect Cursor, Claude Code, Windsurf, and Cline in two minutes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The "Clear sky" page colour (docs/DESIGN.md), as in layout.tsx themeColor.
    background_color: "#F3F8FF",
    theme_color: "#F3F8FF",
    orientation: "portrait-primary",
    categories: ["developer", "productivity", "utilities"],
    // "maskable" icons keep the whole mark, dot included, inside the 80% safe
    // circle that launchers crop to; the "any" icons draw it larger.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
