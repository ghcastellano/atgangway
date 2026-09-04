"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * A parte da sessão que o cabeçalho precisa, vivendo no NAVEGADOR.
 *
 * Começou como o número do coração. Antes ele só existia no servidor:
 * marcar um favorito disparava `revalidatePath("/", "layout")` — a
 * árvore INTEIRA do site era redesenhada para mudar um dígito — e o
 * dígito só aparecia quando essa resposta chegava, segundos depois no
 * wifi do navio. Era a lentidão do coração.
 *
 * Agora ele carrega três coisas, e a razão é maior que o contador:
 *
 *   count      quantos favoritos — o selo do ♡
 *   ids        QUAIS favoritos — quais corações nascem cheios
 *   logado     se há sessão — "Sign in" ou "Sign out" no menu
 *
 * As três vinham do servidor A CADA PÁGINA, e as três leem cookie. Ler
 * cookie no layout raiz é o que obrigava as 43 rotas do site a serem
 * dinâmicas: até /faq, que é texto puro, ia ao banco antes de desenhar.
 * Agora quem as busca é <SessaoSeed/>, uma vez, do navegador, depois da
 * tela pintada — e o documento que a Vercel guarda vale para todos.
 *
 * `logado` nasce `null`, não `false`: enquanto o buraco dinâmico não
 * chegou, não sabemos — e "não sei" não pode ser desenhado como
 * "deslogado", ou quem tem sessão vê "Sign in" por um instante e acha
 * que caiu.
 */
type WishState = {
  count: number;
  /** Ids já favoritados. Vazio até o servidor semear. */
  ids: ReadonlySet<string>;
  /** null enquanto o servidor não respondeu. */
  logado: boolean | null;
  /** Soma (ou subtrai) ao selo, sem esperar o servidor. */
  bump: (delta: number) => void;
  /** Marca/desmarca um id na hora, para o coração da grade. */
  marcar: (id: string, on: boolean) => void;
  /** Valor vindo do servidor: vence o que o navegador acumulou. */
  seed: (n: number, ids?: string[], logado?: boolean) => void;
};

const WishContext = createContext<WishState | null>(null);

export function WishProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [logado, setLogado] = useState<boolean | null>(null);

  const bump = useCallback((d: number) => setCount((c) => Math.max(0, c + d)), []);

  const marcar = useCallback((id: string, on: boolean) => {
    setIds((atual) => {
      if (atual.has(id) === on) return atual;
      const proximo = new Set(atual);
      if (on) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }, []);

  const seed = useCallback((n: number, novosIds?: string[], estaLogado?: boolean) => {
    setCount(Math.max(0, n));
    if (novosIds) setIds(new Set(novosIds));
    if (estaLogado !== undefined) setLogado(estaLogado);
  }, []);

  const value = useMemo(
    () => ({ count, ids, logado, bump, marcar, seed }),
    [count, ids, logado, bump, marcar, seed]
  );
  return <WishContext.Provider value={value}>{children}</WishContext.Provider>;
}

export function useWish(): WishState {
  const ctx = useContext(WishContext);
  if (!ctx) throw new Error("useWish must be used inside <WishProvider>");
  return ctx;
}
