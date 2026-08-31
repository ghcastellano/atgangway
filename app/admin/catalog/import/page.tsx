import Link from "next/link";
import ImportForm from "@/components/admin/ImportForm";

export const dynamic = "force-dynamic";

/**
 * Importar catálogo baixa uma foto por produto de um servidor de fora. Um
 * arquivo de trinta linhas são trinta requisições de saída, e no teto
 * padrão de 15 s da Vercel a ação morre no meio — gravando parte dos
 * produtos e nenhuma foto. Sessenta segundos com o download em paralelo
 * cobre lote dessa ordem; acima disso a via é scripts/importar-catalogo.mjs,
 * que roda no terminal e não tem teto.
 */
export const maxDuration = 60;

export default function ImportPage() {
  return (
    <main className="pb-nav">
      <p className="subhead">Importar catálogo (CSV)</p>
      <div className="stack">
        <p className="note">
          Casamento por <b>SKU</b>: rodar o mesmo arquivo duas vezes atualiza, não duplica. O
          ensaio mostra o que vai mudar antes de gravar.
        </p>
      </div>

      <ImportForm />

      <p className="subhead">Colunas aceitas</p>
      <div className="stack">
        <p className="finehint" style={{ lineHeight: 1.7 }}>
          Obrigatórias: <b className="mono">sku</b>, <b className="mono">name</b>,{" "}
          <b className="mono">price</b>.<br />
          Opcionais: <span className="mono">brand, category, compare_at, stock, short_description,
          description, specs, image, ean, option, badge, tax_class, active</span>.
          <br />
          <br />
          Aceita cabeçalho em português (<span className="mono">codigo, produto, marca, categoria,
          preco, preco_anterior, estoque, ficha, imagem, ativo</span>), separador vírgula ou ponto e
          vírgula, e arquivo salvo pelo Excel com acento.
          <br />
          <br />
          <b>specs</b> separa por barra: <span className="mono">Bluetooth 5.4 | GPS | AMOLED</span>.
          <br />
          <b>compare_at</b> é o preço anterior riscado — se vier menor que o atual, é ignorado e a
          linha entra sem desconto.
        </p>
      </div>

      <div className="actions" style={{ padding: "4px 16px 20px" }}>
        <Link className="btn small ghost" href="/admin/catalog">
          ← Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}
