"use client";

export default function PainelError({ reset }: { reset: () => void }) {
  return (
    <div className="adm-vazio" role="alert">
      <h2>Não foi possível carregar esta seção.</h2>
      <p>Verifique sua conexão e tente novamente. Antes de repetir uma ação, confira se ela foi concluída.</p>
      <button type="button" className="adm-btn primario" onClick={reset}>Tentar novamente</button>
    </div>
  );
}
