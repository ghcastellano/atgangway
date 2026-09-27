/**
 * Dados estruturados (schema.org) em JSON-LD.
 *
 * O Google lê isto para mostrar preço, estoque, migalhas e perguntas
 * direto no resultado. Um componente só, para o escape ser um só: o
 * JSON vai inteiro numa tag script, e "</script" dentro de um texto de
 * produto fecharia a tag — por isso o replace.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
