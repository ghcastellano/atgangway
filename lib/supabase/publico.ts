import { createClient as createAnonClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Cliente do Supabase SEM cookie — para tudo que é igual para todo mundo.
 *
 * A diferença em relação a `lib/supabase/server.ts` não é de estilo: é
 * o que decide se uma página do site pode ser guardada pronta. Aquele
 * chama `cookies()`, e um `cookies()` em qualquer lugar da árvore marca
 * a rota como dinâmica — a página passa a ser recalculada a cada visita,
 * mesmo sendo idêntica para todos. Era o caso de /ports, /attributions e
 * da página de produto: liam o catálogo público com o cliente da sessão
 * e pagavam render por visita por um dado que ninguém personaliza.
 *
 * A RLS de leitura pública cobre o que se lê por aqui. Se uma consulta
 * precisar saber QUEM está pedindo, ela não pertence a este cliente.
 */
export function clientePublico() {
  return createAnonClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
