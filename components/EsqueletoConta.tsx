/**
 * A tela de espera das páginas de conta — com a FORMA do que vem.
 *
 * O que ela conserta: `loading.tsx` era `<div className="spin" />`, um
 * disco de 26px com 40px de margem. Uns 106px de altura no lugar de uma
 * página de 600. Enquanto os dados não chegavam, o <main> encolhia e o
 * RODAPÉ SUBIA PARA O MEIO DA TELA — depois caía de volta quando o
 * conteúdo entrava. Quem clicava em "My Orders" via a página se
 * desmontar e remontar, que é a coisa mais barata que uma interface
 * pode parecer.
 *
 * Duas ideias, as duas emprestadas do painel, que já fazia certo:
 *
 *   Reservar a ALTURA. O esqueleto desenha o mesmo número de blocos que
 *   o conteúdo real vai desenhar, com as mesmas alturas. O rodapé nunca
 *   sobe porque nunca há vão para ele subir.
 *
 *   Reservar a FORMA. Bloco de título onde vai o título, coluna
 *   estreita onde vai o trilho, cartões onde vão os cartões. Um app
 *   premium não mostra "está carregando", mostra "é isto que está
 *   chegando" — e a diferença de percepção de velocidade é grande sem
 *   mudar um milissegundo de velocidade real.
 *
 * Server Component puro: zero JavaScript para desenhar uma espera.
 */
export default function EsqueletoConta({
  forma = "lista",
  linhas = 4,
}: {
  /** A silhueta do conteúdo: cartões empilhados, grade de produtos ou formulário. */
  forma?: "lista" | "grade" | "formulario";
  /** Quantos blocos desenhar. O padrão cobre a altura de uma tela. */
  linhas?: number;
}) {
  return (
    <main className="pg-acct esq" aria-busy="true" aria-label="Loading">
      <div className="esq-crumb" />
      <div className="esq-titulo" />
      {/* A coluna do trilho só existe a partir de 1024px; no celular o
          CSS a esconde, como faz com o AccountRail de verdade. */}
      <div className="esq-trilho">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className={`esq-main ${forma}`}>
        {Array.from({ length: linhas }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    </main>
  );
}
