import Link from "next/link";
import ImportForm from "@/components/admin/ImportForm";

export const dynamic = "force-dynamic";
/* Baixa uma foto por produto de um servidor de fora: 60 s cobrem um lote
   de dezenas de linhas; acima disso, scripts/importar-catalogo.mjs. */
export const maxDuration = 60;

export default function ImportarPage() {
  return (
    <div className="adm-page">
      <div className="adm-secao">
        <h2>Importar catálogo (CSV)</h2>
        <Link className="adm-link" href="/admin/catalog">← Catálogo</Link>
      </div>
      <p className="adm-muted">
        Casamento por <b>SKU</b>: rodar o mesmo arquivo duas vezes atualiza, não duplica. O ensaio mostra o que vai mudar antes de gravar.
      </p>
      <div className="adm-card">
        <ImportForm />
      </div>
      <div className="adm-card">
        <h2>Colunas aceitas</h2>
        <p className="adm-muted" style={{ lineHeight: 1.8 }}>
          Obrigatórias: <b className="mono">sku</b>, <b className="mono">name</b>, <b className="mono">price</b>.<br />
          Opcionais: <span className="mono">brand, category, compare_at, stock, short_description, description, specs, image, ean, option, badge, tax_class, active, track_stock</span>.<br /><br />
          Aceita cabeçalho em português (<span className="mono">codigo, produto, marca, categoria, preco, preco_anterior, estoque, ficha, imagem, ativo</span>), separador vírgula ou ponto e vírgula, e arquivo salvo pelo Excel com acento.<br /><br />
          <b>specs</b> separa por barra: <span className="mono">Bluetooth 5.4 | GPS | AMOLED</span>. <b>compare_at</b> é o preço anterior riscado — se vier menor que o atual, é ignorado.
        </p>
      </div>
    </div>
  );
}
