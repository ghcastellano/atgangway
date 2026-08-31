import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "At Gangway",
    short_name: "Gangway",
    description:
      "Supplies delivered at your gangway. Pre-order before docking — Porto de Santos.",
    start_url: "/",
    display: "standalone",
    background_color: "#01060D",
    theme_color: "#01060D",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
