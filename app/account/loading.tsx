import EsqueletoConta from "@/components/EsqueletoConta";

/** A conta é um formulário: blocos de campo, não cartões. */
export default function Loading() {
  return <EsqueletoConta forma="formulario" linhas={6} />;
}
