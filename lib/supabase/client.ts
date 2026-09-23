"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL_NAVEGADOR, SUPABASE_ANON_KEY } from "@/lib/env";
import type { Database } from "@/lib/database.types";

// createBrowserClient já devolve um singleton por aba.
// Usa o endereço do navegador, não o do servidor: com o proxy ligado, é o
// domínio da loja que aparece nas requisições, e não "supabase.co".
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL_NAVEGADOR, SUPABASE_ANON_KEY);
}
