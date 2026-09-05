import EsqueletoConta from "@/components/EsqueletoConta";

/** Captain: cartão do código, QR e a lista de indicações.
 *  Esta rota também não tinha loading.tsx. */
export default function Loading() {
  return <EsqueletoConta forma="lista" linhas={3} />;
}
