import EsqueletoConta from "@/components/EsqueletoConta";

/** A lista de desejos é uma grade de produtos.
 *  Esta rota NÃO tinha loading.tsx: sem uma fronteira de carregamento
 *  aqui, o Next caía na mais próxima acima e a tela ficava sem forma
 *  enquanto os dados vinham. */
export default function Loading() {
  return <EsqueletoConta forma="grade" linhas={6} />;
}
