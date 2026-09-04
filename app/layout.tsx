import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { WishProvider } from "@/lib/wish";
import ReferralClaim from "@/components/ReferralClaim";
import WishClaim from "@/components/WishClaim";
import ChromeGate from "@/components/ChromeGate";
import SiteChrome from "@/components/SiteChrome";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://atgangway.com"),
  title: {
    default: "At Gangway",
    template: "%s · At Gangway",
  },
  description:
    "Supplies delivered at your gangway. Pre-order before docking — Porto de Santos.",
  openGraph: {
    siteName: "At Gangway",
    title: "At Gangway — supplies delivered at your gangway",
    description:
      "Your order rides with your vessel's ETA. Pre-order before docking, pay a 30% deposit, receive at the gangway. Porto de Santos.",
    type: "website",
    // O cartão que o WhatsApp mostra. O link do Captain viaja colado em
    // grupo de tripulação, e link sem imagem lê como link suspeito —
    // justamente no canal que é o programa inteiro de indicação.
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "At Gangway — supplies delivered at your gangway, Porto de Santos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "At Gangway — supplies delivered at your gangway",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Gangway",
    statusBarStyle: "black-translucent",
  },
};

// Correção do bug de viewport mobile: theme-color escuro + viewport-fit=cover
// fazem o app pintar o viewport inteiro, sem faixa clara sobrando.
export const viewport: Viewport = {
  themeColor: "#01060D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WishProvider>
        <CartProvider>
          <div className="page">
            {/* Cabeçalho e rodapé no layout, não por página: no Sunny
                são globais, e o cliente conta com eles em toda tela. */}
            <div className="shell">
              <ChromeGate>
                <SiteChrome />
              </ChromeGate>
              {children}
              <ChromeGate>
                <SiteFooter />
              </ChromeGate>
            </div>
          </div>
        </CartProvider>
        <ReferralClaim />
        {/* Dentro do WishProvider: ele soma ao selo o que gravou após o login. */}
        <WishClaim />
        </WishProvider>
      </body>
    </html>
  );
}
