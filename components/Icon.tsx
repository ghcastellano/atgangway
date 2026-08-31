/**
 * Ícones de traço, em SVG.
 *
 * Substituem os emoji que estavam no cabeçalho. Emoji parece atalho
 * barato e cobra caro: cada sistema desenha o seu (o 👤 sai azul no
 * iOS e cinza no Android), não obedecem currentColor, têm pesos de
 * traço diferentes entre si, e não dá para alinhar opticamente um
 * conjunto que nem foi desenhado junto. No print do celular o ícone
 * de conta aparecia azul no meio de uma paleta âmbar e navy.
 *
 * Traço de 1.7 e caixa de 24 para todos: é o que faz os três lerem
 * como uma família.
 */

type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false as const,
});

export function IconMenu({ size = 22, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </svg>
  );
}

export function IconUser({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.7-3.7 3.7-5.8 7.2-5.8s6.5 2.1 7.2 5.8" />
    </svg>
  );
}

export function IconHeart({ size = 21, className, filled = false }: Props & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.2s-7.4-4.4-7.4-9.4A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.4 3.2c0 5-7.4 9.4-7.4 9.4Z" />
    </svg>
  );
}

export function IconCart({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.8 3.6h2.3l2.2 10.6h9.6l2.1-7.5H6.2" />
      <circle cx="9.4" cy="19" r="1.5" />
      <circle cx="16.6" cy="19" r="1.5" />
    </svg>
  );
}

export function IconSearch({ size = 20, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2}>
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="m15.4 15.4 4.3 4.3" />
    </svg>
  );
}

export function IconClose({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2}>
      <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

export function IconTrash({ size = 17, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.5 6.6h15M9.4 6.6V4.8h5.2v1.8M6.6 6.6l.9 12.1h9l.9-12.1M10.3 10v5.4M13.7 10v5.4" />
    </svg>
  );
}

/** A marca do At Gangway — o momento da entrega, desenhado: o casco
 *  atracado no alto (escotilhas acesas), a PRANCHA DE EMBARQUE com
 *  degraus descendo, e o pacote esperando na ponta. Cais e linha
 *  d'água separados por um vão — o navio de um lado, a entrega do
 *  outro, a prancha no meio. É o negócio inteiro num símbolo.
 *  Mantém o nome IconAnchor para não mexer nos imports; é só o
 *  símbolo do logotipo, com uma casa só. */
export function IconAnchor({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.7}>
      <path d="M9.2 3.8H21.7L19.4 7.9H10.3ZM12.3 5.9h.01M14.9 5.9h.01M17.5 5.9h.01M10.3 7.9 2.6 19.9M11.98 8.98 4.28 20.98M7.99 11.5 9.67 12.58M6.07 14.5 7.75 15.58M4.14 17.5 5.82 18.58M7.7 18h3.1v3.2H7.7ZM9.25 18v3.2M2 21.2h9.8M14 21.2h8M15.8 19.3h3.4" />
    </svg>
  );
}

/** Caixa de mantimento. Substitui o 📦 nos lugares onde falta foto:
 *  emoji colorido sobre o painel branco lia como conteúdo, não como
 *  ausência — e cada sistema desenhava uma caixa diferente. */
export function IconPackage({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m12 3.2 8.2 4.1v9.4L12 20.8l-8.2-4.1V7.3Z" />
      <path d="M3.8 7.3 12 11.4l8.2-4.1M12 11.4v9.4M7.9 5.3l8.2 4.1" />
    </svg>
  );
}

/** Bússola dos estados de busca: "nada encontrado" aponta um rumo. */
export function IconCompass({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m15.4 8.6-2 5-5 2 2-5Z" />
    </svg>
  );
}

/** Quepe do Captain — o programa de indicação tem posto, não emoji. */
export function IconCap({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5.2 12.6c0-3.5 3-5.6 6.8-5.6s6.8 2.1 6.8 5.6" />
      <path d="M3.8 12.6h16.4l-.9 3.2H4.7Z" />
      <path d="M12 9.8h.1" />
    </svg>
  );
}

/** Porta com seta: sair da conta. O ⎋ que morava aqui é tecla de
 *  escape em fonte de sistema — cada aparelho desenhava um glifo. */
export function IconLogout({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 4.5H5.5v15H10" />
      <path d="m14.8 8.5 3.5 3.5-3.5 3.5M18.3 12H9.6" />
    </svg>
  );
}

/** Entrar — o IconLogout espelhado (a seta ENTRA na porta).
 *  O item "Sign in" da gaveta usava o símbolo da MARCA como ícone de
 *  menu: sobra da época da âncora, e marca ao lado de "Sign in" lê como
 *  logotipo perdido numa lista, não como ação. */
export function IconLogin({ size = 21, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 4.5h4.5v15H14" />
      <path d="m9.2 8.5 3.5 3.5-3.5 3.5M12.7 12H4" />
    </svg>
  );
}
