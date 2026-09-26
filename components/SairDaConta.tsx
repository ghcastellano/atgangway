"use client";

import { useRouter } from "next/navigation";
import { useWish } from "@/lib/wish";
import { useCart } from "@/lib/cart";
import { signOut } from "@/app/account/actions";

/**
 * Sair da conta — o único caminho, nos cinco lugares que oferecem sair.
 *
 * Existia como `<form action={signOut}>` copiado em cada um deles, e a
 * cópia escondia dois defeitos que juntos davam o mesmo sintoma para
 * quem usa: apertar sair e continuar dentro.
 *
 * 1. NO MENU DO CABEÇALHO, A AÇÃO NEM CHEGAVA A RODAR.
 *
 *    O botão de lá fechava o próprio menu no `onClick`. Fechar o menu
 *    desmonta o <form> — e um <form> que some no meio do envio leva a
 *    Server Action junto. O cookie ficava inteiro. Medido: cookies
 *    antes 2, depois do clique 2, e o menu ainda oferecendo "Sign out".
 *    Os outros quatro botões funcionavam porque nenhum deles fechava
 *    nada; o do painel admin é o mesmo código sem o `onClick`.
 *
 *    Por isso quem fecha o menu aqui é a navegação, não o clique.
 *
 * 2. QUANDO A AÇÃO RODAVA, A CASCA DO SITE NÃO FICAVA SABENDO.
 *
 *    "Sign in" ou "Sign out" no cabeçalho vem do estado do navegador
 *    (lib/wish), semeado UMA vez pelo <SessaoSeed/> quando o layout
 *    raiz monta. O `redirect()` de uma Server Action é navegação de
 *    cliente: não remonta layout, então o SessaoSeed não busca de
 *    novo. Resultado medido: cookie apagado, `/account` já barrando, e
 *    o menu do cabeçalho ainda dizendo "Sign out" até alguém recarregar
 *    na mão. Para quem olha, isso é não ter deslogado.
 *
 *    `revalidatePath` não alcança isso — ele invalida o que o SERVIDOR
 *    guardou, e este estado é do navegador.
 *
 * A saída é o cliente conduzir: a action apaga o cookie e volta (sem
 * redirect, veja app/account/actions.ts), e só então, aqui, o navegador
 * esquece a sessão e navega. A ordem importa — apagar o estado ANTES
 * trocaria este <form> por um link "Sign in" no meio do envio, que é
 * exatamente o defeito 1 de volta.
 */
export default function SairDaConta({
  className,
  children,
  ariaLabel,
  role,
}: {
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  role?: string;
}) {
  const { seed } = useWish();
  const { esquecerDono } = useCart();
  const router = useRouter();

  return (
    <form
      action={async () => {
        await signOut();
        // O provedor vive acima deste form (layout raiz), então continua
        // montado mesmo depois de o menu sumir — a atualização chega.
        seed(0, [], false);
        // O carrinho é da conta, não do navegador: quem entrar depois
        // (outra pessoa no mesmo computador de bordo) não pode vê-lo.
        esquecerDono();
        router.replace("/");
        router.refresh();
      }}
    >
      <button type="submit" className={className} aria-label={ariaLabel} role={role}>
        {children}
      </button>
    </form>
  );
}
