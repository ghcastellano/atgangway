import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { WishProvider } from "@/lib/wish";
import ReferralClaim from "@/components/ReferralClaim";
import WishClaim from "@/components/WishClaim";
import { Analytics } from "@vercel/analytics/next";
import ChromeGate from "@/components/ChromeGate";
import SiteChrome from "@/components/SiteChrome";
import SiteFooter from "@/components/SiteFooter";
import SkipToContent from "@/components/SkipToContent";

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
    // "black-translucent" desenha a barra de status transparente com
    // ÍCONES BRANCOS por cima do conteúdo. Fazia sentido sobre a loja
    // escura; sobre o fundo claro de hoje os ícones somem — relógio e
    // bateria brancos sobre #E9EEF4. "default" devolve a barra opaca
    // com ícones escuros, que é o que se lê.
    statusBarStyle: "default",
  },
};

/**
 * A moldura do navegador no celular.
 *
 * Estes dois valores sobraram da época em que a loja era escura e não
 * foram junto na inversão para o tema claro — e não era detalhe:
 *
 *   themeColor pinta a barra de status do iOS e a de endereço do
 *   Android. Ficou #01060D, quase preto, encostada numa página de
 *   fundo #F5F8FB. É a faixa que o cliente vê antes de qualquer
 *   conteúdo carregar.
 *
 *   colorScheme: "dark" é pior porque é funcional: ela manda o sistema
 *   desenhar os controles NATIVOS em modo escuro — <select>, campo de
 *   data, barra de rolagem, o menu de sugestão do teclado. O
 *   formulário do checkout ficava com caixas escuras no meio de cartões
 *   brancos, e a rolagem sumia contra o fundo.
 *
 * O valor agora é --abyss, que é o fundo REAL do <body> (conferido no
 * navegador, não no token que eu supunha) — a barra do sistema e a
 * página viram uma superfície só. O viewport-fit=cover continua, que é
 * o que faz o app ocupar a tela inteira do iPhone com entalhe.
 */
export const viewport: Viewport = {
  themeColor: "#E9EEF4",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkipToContent />
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
        {/* Contagem de visitas da Vercel: sem cookie, sem dado pessoal —
            é o que responde "quantos acessos e de onde". Precisa estar
            ligado no painel do projeto (Analytics → Enable) para
            registrar; sem isso o script não custa nada e não conta. */}
        <Analytics />
        <ReferralClaim />
        {/* Dentro do WishProvider: ele soma ao selo o que gravou após o login. */}
        <WishClaim />
        </WishProvider>
      </body>
    </html>
  );
}
