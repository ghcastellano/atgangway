"use server";

import { revalidatePath } from "next/cache";
import { callState, canOrder } from "@/lib/callstate";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { missingProfileFields } from "@/lib/profile";

/**
 * Sair — de verdade, inclusive na tela.
 *
 * O cookie sempre foi apagado direito; quem não sabia era a interface.
 * O cabeçalho é montado pelo SiteChrome, que pergunta ao servidor quem
 * está logado e mora no LAYOUT RAIZ — e layout não re-renderiza numa
 * navegação de cliente, que é o que o redirect() faz. A sessão morria e
 * o menu seguia oferecendo "Sign out" até alguém recarregar na mão.
 * revalidatePath com escopo "layout" é o que derruba essa memória.
 *
 * E o signOut do Supabase é chamada de REDE (revoga o refresh token no
 * servidor). Se ela falhar — wifi de navio existe — a biblioteca pode
 * deixar o cookie para trás, e aí a pessoa clicou em sair e continuou
 * dentro. Nesse caso o cookie sai na marra: a vontade de sair não
 * depende da rede.
 */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(JSON.stringify({ at: "sign_out", message: error.message }));
    const store = await cookies();
    // sb-<ref>-auth-token, às vezes partido em .0/.1 quando a sessão
    // não cabe num cookie só — por isso o prefixo, não o nome exato.
    for (const c of store.getAll()) {
      if (c.name.startsWith("sb-")) store.delete(c.name);
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export type ProfileInput = {
  firstName: string;
  lastName: string;
  rankSlug: string;
  nationality: string;
  /** E.164 completo, montado pelo PhoneInput. Vazio = não mexer no salvo. */
  whatsapp: string;
  portId: string;
  shipId: string | null;
  vesselName: string;
  vesselImo: string | null;
  vesselFlag: string | null;
};

export type SaveProfileResult =
  | { ok: true; complete: boolean; /** O que o checkout ainda vai cobrar, na ordem da tela. */ missing: string[] }
  | { ok: false; error: string };

const clean = (v: string | null | undefined, max: number) =>
  (v ?? "").trim().slice(0, max) || null;

/**
 * Grava o cadastro que o checkout confirma.
 *
 * O checkout não é formulário: ele lê estes campos e recusa o pagamento
 * quando falta um. Esta é a única tela onde eles nascem, então a validação
 * tem de ser a mesma do placeOrder — descobrir que o telefone está fora do
 * formato só na hora de pagar é o pior lugar para descobrir.
 */
export async function saveProfile(input: ProfileInput): Promise<SaveProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired — please sign in again." };

  // O banco guarda um full_name só: é o nome que vai na prancha de
  // embarque. Juntar de volta é exato porque o primeiro nome é o primeiro
  // token e todo o resto foi para o sobrenome.
  const fullName = `${(input.firstName ?? "").trim()} ${(input.lastName ?? "").trim()}`
    .trim()
    .slice(0, 120);
  if (!fullName) return { ok: false, error: "First and last name are required." };

  // Mesma regra E.164 do placeOrder. Campo vazio NÃO apaga o que já está
  // salvo: o PhoneInput nasce em branco a cada montagem, e um formulário
  // de edição que zera o telefone de quem só mudou o porto é uma armadilha.
  const wa = (input.whatsapp ?? "").replace(/[^\d+]/g, "");
  if (wa && !/^\+\d{8,15}$/.test(wa)) {
    return { ok: false, error: "That telephone number isn't valid — include the country code." };
  }

  const { data: current } = await supabase
    .from("profiles")
    .select("whatsapp, profile_completed_at, ship_id")
    .eq("id", user.id)
    .maybeSingle();

  // Trocar PARA uma escala fechada é o beco que o picker deixou de
  // oferecer; aqui é a segunda tranca. Só na troca: quem já está numa
  // escala encerrada continua podendo corrigir o telefone.
  const shipId = clean(input.shipId, 36);
  if (shipId && shipId !== current?.ship_id && (await callClosed(supabase, shipId))) {
    return {
      ok: false,
      error: "That call's order window has closed — pick your vessel's next call, or create it.",
    };
  }

  const whatsapp = wa || clean(current?.whatsapp, 20);
  const portId = clean(input.portId, 36);
  const vesselName = clean(input.vesselName, 120)?.toUpperCase() ?? null;

  // "Completo" é exatamente o que o checkout exige para liberar o
  // pagamento. O carimbo marca a PRIMEIRA vez que fechou — remarcar a cada
  // salvamento apagaria desde quando o cadastro vale.
  //
  // A regra do que falta mora em lib/profile: a tela da conta e o
  // retorno do Google perguntam a mesma coisa.
  const missing = missingProfileFields({
    full_name: fullName,
    vessel_name: vesselName,
    port_id: portId,
    whatsapp,
  });
  const complete = missing.length === 0;
  const profileCompletedAt = complete
    ? (current?.profile_completed_at ?? new Date().toISOString())
    : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      rank_slug: clean(input.rankSlug, 40),
      nationality: clean(input.nationality, 2)?.toUpperCase() ?? null,
      whatsapp,
      port_id: portId,
      ship_id: shipId,
      vessel_name: vesselName,
      vessel_imo: clean(input.vesselImo, 20),
      vessel_flag: clean(input.vesselFlag, 60),
      profile_completed_at: profileCompletedAt,
    })
    .eq("id", user.id);

  if (error) {
    // Erro mudo na tela custou uma sessão inteira de diagnóstico: a
    // causa era 42501 (sem GRANT de UPDATE), e "try again" não dizia
    // nada a ninguém. O detalhe vai para o log do servidor, e a tela
    // separa os dois casos que o usuário pode resolver sozinho dos que
    // ele não pode.
    console.error(
      JSON.stringify({ at: "save_profile", user: user.id, code: error.code, message: error.message })
    );
    if (error.code === "42501") {
      return {
        ok: false,
        error: "We can't write to your profile right now — our side, not yours. We're on it.",
      };
    }
    if (error.code === "23503") {
      return {
        ok: false,
        error: "That vessel or port is no longer on file — pick it again from the list.",
      };
    }
    return { ok: false, error: "Couldn't save your details — try again." };
  }

  // O checkout lê o perfil no servidor: sem invalidar, ele seguiria
  // mostrando o dado antigo (e barrando o pagamento) depois de corrigido.
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true, complete, missing };
}

/**
 * A escala ainda aceita pedido? Só responde "não" quando o navio é
 * visível e a janela já fechou: navio que a RLS esconde (escala fora do
 * line-up) não é motivo para travar a conta — o pedido é barrado depois,
 * no place_order, pela mesma régua.
 */
async function callClosed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shipId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("ships")
    .select("eta, ata, cutoff_hours")
    .eq("id", shipId)
    .maybeSingle();
  return Boolean(data && !canOrder(callState(data)));
}

/**
 * Re-vínculo de escala em um toque.
 *
 * O contrato de bordo acaba, o navio zarpa, e o perfil continua apontando
 * para uma escala morta — o cliente é permanente, a ESCALA é que é
 * efêmera. Quem expira aqui não é a sessão (o refresh token dura semanas,
 * e é bom que dure): é o vínculo.
 *
 * Só troca o navio. Nome, posto, telefone, porto e o carrinho ficam onde
 * estão — é a diferença entre "continuar de onde parou" e "recomeçar",
 * que é o que um formulário completo faria a pessoa sentir.
 */
export async function switchVessel(shipId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired — please sign in again." };

  // Os dados do navio são copiados para o perfil de propósito: o pedido
  // não pode depender da visibilidade da escala (a RLS esconde navio
  // fora do line-up, e já gravou pedido sem navio nenhum por isso).
  const { data: navio } = await supabase
    .from("ships")
    .select("id, name, flag, imo, eta, ata, cutoff_hours")
    .eq("id", shipId)
    .maybeSingle();
  if (!navio) return { ok: false, error: "That call is no longer on the line-up — pick another." };
  // A home só sugere escala com janela aberta, mas o id chega do cliente.
  if (!canOrder(callState(navio))) {
    return { ok: false, error: "That call's order window has closed — pick another." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ship_id: navio.id,
      vessel_name: navio.name?.toUpperCase() ?? null,
      vessel_flag: navio.flag ?? null,
      vessel_imo: navio.imo ?? null,
    })
    .eq("id", user.id);

  if (error) {
    console.error(
      JSON.stringify({ at: "switch_vessel", user: user.id, code: error.code, message: error.message })
    );
    return { ok: false, error: "Couldn't switch your vessel — try again." };
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true };
}
