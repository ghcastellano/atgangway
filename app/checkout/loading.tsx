/**
 * O checkout tem forma própria — um cartão de resumo, não a grade da
 * conta —, então não usa o EsqueletoConta. Mas conserta o mesmo
 * defeito: era `<div className="spin" />`, 106px de altura numa página
 * de 600, e o rodapé subia para o meio da tela enquanto o pedido
 * carregava. Na tela em que a pessoa está prestes a pagar.
 */
export default function Loading() {
  return (
    <main className="pg-checkout esq" aria-busy="true" aria-label="Loading">
      <div className="esq-titulo" />
      <div className="esq-main lista">
        <span /><span /><span /><span />
      </div>
    </main>
  );
}
