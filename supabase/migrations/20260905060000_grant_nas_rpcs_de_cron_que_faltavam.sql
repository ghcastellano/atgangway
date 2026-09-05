-- Quatro RPCs de cron nunca receberam EXECUTE para anon.
--
-- Os crons deste projeto rodam com a chave ANÔNIMA e se autenticam pelo
-- segredo que passam como argumento — é o desenho, e é por isso que não
-- existe service_role no ambiente da Vercel. Quatorze RPCs têm o
-- `grant execute ... to anon, authenticated` explícito na migração que
-- as criou. Estas quatro, criadas em 27/08, não têm.
--
-- Resultado: 42501 a cada hora. Confirmado nos logs do Postgres —
-- três falhas por hora, ininterruptas, desde antes de qualquer mudança
-- recente. Não foi regressão: nasceu assim e nunca funcionou.
--
-- O que estava parado, e o mais grave é dinheiro:
--
--   credit_skipped_calls   depósito de escala desviada virava crédito
--                          integral na conta do cliente. NUNCA rodou. O
--                          comentário no cron diz, com todas as letras,
--                          que era "a promessa que o checkout já fazia
--                          por escrito e que ninguém cumpria" — e
--                          continuou não cumprindo.
--   claim_call_reminders   o aviso de última chamada antes do corte.
--   release_call_reminder  a devolução da reivindicação quando o e-mail
--                          falha. Até o caminho de recuperação estava
--                          quebrado.
--   rotate_ship_calls      escala vencida saindo de cena.
--
-- Conferido no momento da correção: nenhum cliente foi lesado. Os seis
-- pedidos existentes têm escala futura e ativa, então não houve desvio
-- para creditar. A escala mais próxima é no dia seguinte a este patch.
grant execute on function public.rotate_ship_calls(text)      to anon, authenticated;
grant execute on function public.credit_skipped_calls(text)   to anon, authenticated;
grant execute on function public.claim_call_reminders(text)   to anon, authenticated;
grant execute on function public.release_call_reminder(uuid, uuid, date, text) to anon, authenticated;
