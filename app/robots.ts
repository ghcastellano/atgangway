import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

/**
 * /robots.txt — respondia 404 em produção, o que deixava os buscadores
 * adivinhando o que rastrear.
 *
 * As telas de conta, pedido, carrinho e admin ficam de fora: além de
 * não servirem para busca, /orders/[code] e /r/[code] carregam código
 * de pedido e de indicação, e código indexado é código vazado.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/orders",
          "/checkout",
          "/cart",
          "/wishlist",
          "/captain",
          "/admin",
          "/api/",
          "/auth/",
          "/r/",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
