"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  SUPABASE_URL_NAVEGADOR,
  SUPABASE_ANON_KEY,
  SUPABASE_STORAGE_KEY,
} from "@/lib/env";
import type { Database } from "@/lib/database.types";

// createBrowserClient já devolve um singleton por aba.
// Usa o endereço do navegador, não o do servidor: com o proxy ligado, é o
// domínio da loja que aparece nas requisições, e não "supabase.co".
//
// O storageKey vai explícito porque o @supabase/ssr o deriva do hostname —
// e com dois endereços diferentes cada lado gravaria a sessão num cookie
// diferente. Ver o comentário em lib/env.
/**
 * Apaga cookies de sessão com OUTRO nome.
 *
 * Nos dias em que o proxy gravava a sessão em `sb-atgangway-auth-token`,
 * quem entrou ficou com esse cookie — e ele não some sozinho. Depois da
 * correção, a sessão nova vai para `sb-<ref>-auth-token`, e os dois
 * juntos (cada um em 2–3 pedaços de ~3 KB) passam do tamanho de
 * cabeçalho que a borda aceita: as navegações do app falham em silêncio
 * e o login parece travar em "Signed in — opening your account…".
 *
 * Roda uma vez por aba, no primeiro createClient. Só toca em cookies
 * `sb-*-auth-token*` cujo nome não é o nosso.
 */
let jaLimpou = false;
function limparSessoesDeOutroNome() {
  if (jaLimpou || typeof document === "undefined" || !SUPABASE_STORAGE_KEY) return;
  jaLimpou = true;
  for (const par of document.cookie.split(";")) {
    const nome = par.split("=")[0].trim();
    if (!/^sb-.+-auth-token/.test(nome) || nome.startsWith(SUPABASE_STORAGE_KEY)) continue;
    // O cookie pode ter sido gravado com ou sem domínio; apaga dos dois jeitos.
    document.cookie = `${nome}=; Max-Age=0; path=/`;
    document.cookie = `${nome}=; Max-Age=0; path=/; domain=${location.hostname}`;
  }
}

export function createClient() {
  limparSessoesDeOutroNome();
  return createBrowserClient<Database>(SUPABASE_URL_NAVEGADOR, SUPABASE_ANON_KEY, {
    auth: { storageKey: SUPABASE_STORAGE_KEY },
  });
}
