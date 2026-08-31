import type { NextConfig } from "next";

/* De quais hosts o next/image aceita buscar foto.
 *
 * Era um só, com o ref do projeto colado à mão. Isso quebraria no dia
 * em que o endereço da Supabase mudasse — e mudou: o Auth passou a
 * atender em auth.marinerssupplyco.com, então uma URL de Storage
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
