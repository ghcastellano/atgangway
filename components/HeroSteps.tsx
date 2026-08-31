import Link from "next/link";
import { DEPOSIT_PCT } from "@/lib/money";

/**
 * Como funciona, ao lado do herói.
 *
 * Existe por um buraco de layout com causa de conteúdo: no desktop o
 * herói divide a fileira com o painel do navio, mas o painel só aparece
 * para quem já tem navio na conta. Deslogado — que é o estado de todo
 * visitante novo — sobravam 40% da largura em preto.
 *
 * Encher com decoração seria desperdício do lugar mais visto da loja.
 * Quem chega aqui pela primeira vez não sabe que dá para pedir antes de
 * atracar, nem que são 30% de entrada, nem que a entrega é na prancha —
 * e isso não estava escrito em lugar nenhum do site.
 *
 * Server Component: é texto, não interação.
 */

const PASSOS = [
  {
    n: "01",
    titulo: "Pre-order before you dock",
    texto: "Pick your supplies from the ship, days before arrival. No queue, no shore trip.",
  },
  {
    n: "02",
    titulo: `Pay a ${DEPOSIT_PCT}% deposit`,
    texto: "Card or PIX. The balance is settled at the gangway, in cash or card.",
  },
  {
    n: "03",
    titulo: "Collect at the gangway",
    texto: "We meet the vessel at your berth, on the day your port line-up says.",
  },
];

export default function HeroSteps() {
  return (
    <aside className="herosteps" aria-label="How ordering works">
      <p className="lb">How it works</p>
      <ol>
        {PASSOS.map((p) => (
          <li key={p.n}>
            <span className="n" aria-hidden>
              {p.n}
            </span>
            <span className="tx">
              <span className="nm">{p.titulo}</span>
              <span className="ct">{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href="/faq" className="mais" prefetch={false}>
        Questions crews ask ›
      </Link>
    </aside>
  );
}
