"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit que ADMITE que foi clicado.
 *
 * Todo botão do admin era `<button type="submit">` puro dentro de um
 * form com server action. O navegador não dá retorno nenhum nesse
 * caminho: o clique some, a ação viaja, o `revalidatePath` reconstrói a
 * página inteira no servidor e só então a tela muda. No meio disso — de
 * meio segundo a três, dependendo da rede do navio — a interface fica
 * idêntica a antes do clique.
 *
 * O efeito prático não é "lento", é AMBÍGUO: quem clica não sabe se
 * pegou, clica de novo, e a segunda submissão chega. Em "Publicar" isso
 * é inofensivo (idempotente), mas o hábito que ele ensina não é.
 *
 * `useFormStatus` lê o estado do form ANCESTRAL — por isso este
 * componente precisa ser filho do <form>, e por isso ele é cliente
 * enquanto a página segue servidor. Custo: um bundle de poucos bytes,
 * nenhum estado próprio.
 */
export default function BotaoAcao({
  children,
  ocupado,
  className = "btn small",
}: {
  children: React.ReactNode;
  /** Rótulo enquanto a ação viaja. Sem ele, repete o rótulo normal. */
  ocupado?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (ocupado ?? children) : children}
    </button>
  );
}
