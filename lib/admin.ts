import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Esta pessoa é da equipe?" — uma pergunta, um lugar.
 *
 * A consulta já existia escrita à mão no layout do /admin, e as telas de
 * conta simplesmente não a faziam: passavam isAdmin=false por omissão e
 * o item "Staff panel" sumia do menu ao navegar de /account para
 * /orders. Regra de autorização repetida em N arquivos é regra que
 * diverge; regra ESQUECIDA em N arquivos é a versão silenciosa disso.
 *
 * Não substitui a checagem de acesso: quem protege o /admin continua
 * sendo o layout dele, e antes disso a RLS no banco. Esta função serve
 * para DECIDIR O QUE MOSTRAR — esconder um link que a pessoa não pode
 * usar, e mostrar o que ela pode.
 */
export async function ehAdmin(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin";
}
