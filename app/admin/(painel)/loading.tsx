/** Esqueleto: a casca já está na tela; só o conteúdo pisca. */
export default function Loading() {
  return (
    <div className="adm-skel" aria-busy="true" aria-label="Carregando">
      <div className="adm-skel-kpis">
        <span /><span /><span /><span />
      </div>
      <div className="adm-skel-linhas">
        <span /><span /><span /><span /><span />
      </div>
    </div>
  );
}
