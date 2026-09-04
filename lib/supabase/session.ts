import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quem está logado — sem ir ao servidor de Auth.
 *
 * `auth.getUser()` faz UMA viagem ao Supabase Auth a cada chamada, e o
 * app chamava isso no proxy, no cabeçalho, na página e na action: três
 * ou quatro idas por clique, cada uma cruzando o oceano (as functions
 * rodavam em Washington e o banco fica em São Paulo). Era a metade da
 * lentidão que "não tinha dono".
 *
 * `getClaims()` verifica a assinatura do JWT localmente, com a chave
 * pública do projeto (JWKS, buscada uma vez e guardada em memória). O
 * projeto já assina com chave assimétrica (ES256), então a verificação
 * é criptográfica, não confiança no cookie. Quando o token venceu, o
 * cliente renova pelo refresh token — o mesmo que getUser fazia — e o
 * proxy continua gravando o cookie novo.
 *
 * Devolve só o que o app usa: id e e-mail. Quem precisar do objeto
 * inteiro do usuário (raro) chama getUser de propósito.
 */
export type SessionUser = { id: string; email: string | null };

/** Só o que a função toca: serve para o client tipado do servidor e para o do proxy. */
type ComAuth = { auth: Pick<SupabaseClient["auth"], "getClaims"> };

export async function sessionUser(supabase: ComAuth): Promise<SessionUser | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const c = data.claims as { sub: string; email?: string };
    return { id: c.sub, email: c.email ?? null };
  } catch {
    return null;
  }
}
