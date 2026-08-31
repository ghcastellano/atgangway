import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vessel Supplier",
    short_name: "Vessel",
    description:
      "Pre-order supplies before docking — delivered at the gangway. Porto de Santos.",
    start_url: "/",
    display: "standalone",
    background_color: "#01060D",
    theme_color: "#01060D",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
