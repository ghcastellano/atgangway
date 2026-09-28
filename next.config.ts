import type { NextConfig } from "next";

/* De quais hosts o next/image aceita buscar foto.
 *
 * Era um só, com o ref do projeto colado à mão. Isso quebraria no dia
 * em que o endereço da Supabase mudasse — e mudou: o Auth passou a
 * atender num domínio customizado, então uma URL de Storage
 * montada a partir de NEXT_PUBLIC_SUPABASE_URL aponta para lá. Host
 * fora desta lista faz o next/image responder 400 e a foto simplesmente
 * não aparecer. Não há erro de build, não há aviso: a página monta com
 * buracos, que é o pior tipo de falha para descobrir em produção.
 *
 * Agora o host sai da própria variável, então não existe o que
 * desalinhar. O ref antigo continua na lista de propósito: o domínio
 * *.supabase.co segue servindo depois da ativação do domínio custom, e
 * linhas antigas de product_images podem guardar URL absoluta com ele.
 */
const hostDaVariavel = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cuaocjxofaizefzcxlyc.supabase.co").hostname;
  } catch {
    return null;
  }
})();

const hostsDeFoto = [
  ...new Set([hostDaVariavel, "cuaocjxofaizefzcxlyc.supabase.co"].filter(Boolean)),
] as string[];

const nextConfig: NextConfig = {
  // Congela no build "estamos na Vercel?" para os DOIS bundles (o
  // process.env.VERCEL cru não chega ao navegador). É o que permite a
  // lib/env aplicar a retaguarda de produção só onde ela pertence.
  env: {
    NEXT_PUBLIC_ON_VERCEL: process.env.VERCEL ? "1" : "",
  },

  /* O Supabase atendendo pelo domínio da loja.
   *
   * O add-on de domínio próprio do Supabase custa US$ 10/mês para que o
   * cliente nunca veja "cuaocjxofaizefzcxlyc.supabase.co". Estes rewrites
   * fazem o mesmo de graça: o navegador chama atgangway.com/auth/v1/... e
   * a borda da Vercel repassa. Ligado por NEXT_PUBLIC_SUPABASE_PROXY=1,
   * que é o que faz lib/env apontar o cliente do navegador para cá.
   *
   * O que isto NÃO resolve: o endereço de retorno do login com Google.
   * Esse vem da configuração interna do Auth do Supabase, não do host que
   * chamou — testado, o resultado é idêntico com e sem proxy. Para trocar
   * aquilo só existe o add-on pago.
   *
   * Os caminhos são os três que o navegador usa. /realtime fica de fora:
   * o app não abre websocket, e proxy de websocket na Vercel cobra por
   * conexão aberta.
   */
  // public/ sai da Vercel com max-age=0: cada visita revalidava as
  // fontes e a imagem social. As fontes têm hash no nome — imutáveis.
  async headers() {
    return [
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/og.png", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
  async rewrites() {
    const alvo = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://cuaocjxofaizefzcxlyc.supabase.co"
    ).replace(/\/+$/, "");
    return [
      { source: "/auth/v1/:path*", destination: `${alvo}/auth/v1/:path*` },
      { source: "/rest/v1/:path*", destination: `${alvo}/rest/v1/:path*` },
      { source: "/storage/v1/:path*", destination: `${alvo}/storage/v1/:path*` },
    ];
  },
  images: {
    // Foto de produto vem do Storage público do Supabase. next/image
    // faz o resize e serve AVIF/WebP: numa grade de 24 cards isso é a
    // diferença entre 6 MB e 300 KB no wifi do navio.
    remotePatterns: hostsDeFoto.map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/storage/v1/object/public/**",
    })),
    formats: ["image/avif", "image/webp"],
  },
  // nodemailer usa require dinâmico: bundlar quebra o transporte.
  serverExternalPackages: ["nodemailer"],
  experimental: {
    serverActions: {
      // A foto da entrega já sai encolhida do navegador (~250 KB),
      // mas HEIC que o canvas não decodifica sobe original. 8 MB é o
      // mesmo teto do bucket — os dois limites falam a mesma língua.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
