import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "At Gangway",
    short_name: "Gangway",
    description:
      "Supplies delivered at your gangway. Pre-order before docking — Porto de Santos.",
    start_url: "/",
    display: "standalone",
    // As duas cores do tema claro, não as da loja escura de antes.
    // background_color é a tela de abertura do app instalado: em
    // #01060D ela dava um flash quase preto antes de abrir uma loja
    // branca — o pior primeiro quadro possível para quem põe o
    // atalho na tela inicial. Ficam iguais a --night.
    background_color: "#E9EEF4",
    theme_color: "#E9EEF4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
