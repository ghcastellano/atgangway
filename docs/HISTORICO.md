# At Gangway — passagem de bastão

> Para quem abre um chat novo em `github.com/ghcastellano/atgangway` e precisa
> do contexto sem esta sessão. Estado em **2026-09-04**. Tudo o que está aqui
> foi verificado contra produção, não relembrado.

## O que é

Loja de ship supply para tripulações de navios atracados no **Porto de
Santos**. Next.js 16 (App Router, Server Actions, `proxy.ts`) + Supabase (Postgres, RLS,
RPCs `SECURITY DEFINER` guardadas por segredo em `app_secrets`). Domínio
`atgangway.com` na Vercel (projeto `atgangway`), e-mail `help@atgangway.com`
na Hostinger, Supabase `cuaocjxofaizefzcxlyc` (região São Paulo).

Modelo: a tripulação escolhe o navio (line-up do porto sincronizado de hora em
hora), monta o pedido antes do corte (72 h antes do ETA), paga **30 % de
depósito** no Stripe e o saldo na escada de portaló. Preço em USD, 5× o custo
brasileiro, PTAX do Banco Central por cron.

## Onde as coisas vivem

| o quê | onde |
|---|---|
| código | `github.com/ghcastellano/atgangway`, branch `main` — é o único repositório que importa |
| deploy | Vercel, projeto `atgangway`, produção em `atgangway.com`; cada push em `main` publica. Functions em **gru1** (`vercel.json`) — o banco é sa-east-1 |
| banco | Supabase `cuaocjxofaizefzcxlyc`; migrações aplicadas via MCP e **documentadas** em `supabase/migrations/` (o repositório é registro, o banco é a verdade) |
| tipos do banco | `lib/database.types.ts` — gerado; regenera com `supabase gen types` ou o MCP |
| testes | `npm test` (Node test runner, 252; os 54 responsivos rodam só com `next build && next start -p 3100` no ar, senão pulam) e `supabase/tests/{dinheiro,escala}.sql` (pgTAP, 11 invariantes de dinheiro + 5 do picker de navio; rodam inteiros pelo `execute_sql` do MCP, com rollback) |
| fotos do catálogo | `public/produtos/` (build, CDN da Vercel) e Storage `product-images` (upload pelo admin) |
| crons | pg_cron no banco: line-up (hora em hora), PTAX (14:30 dias úteis), digest diário (09:00 UTC); chamam rotas `/api/cron/*` com Bearer conferido no banco (`is_cron_secret`) |

## Por que a sessão anterior se chamava "chamanositev2"

O chat foi aberto a partir de outro repositório e o Claude Code nomeia a sessão
pelo repositório de origem — e gera links de arquivo apontando para lá, que
dão 404. **Nenhum commit foi para o chamanositev2.** Um chat novo aberto direto
em `atgangway` resolve os links.

## Decisões que não devem ser refeitas

- **Pedido é uma RPC atômica e idempotente** (`place_order`): chave de
  idempotência por carrinho, preços do banco, janela conferida em SQL, crédito
  dentro da transação, **estoque com lock + baixa + CHECK ≥ 0** (pgTAP 11/11).
  Nunca voltar a inserir em `orders`/`order_items` pelo app.
- **Stripe**: Checkout hospedado, idempotency key `deposit-<order>-<cents>`,
  webhook com dedup por evento (`stripe_events`) e segredo próprio
  (`STRIPE_CONFIRM_SECRET`), não o signing secret. Hoje em **modo teste**.
- **Env**: fallbacks de produção só quando `NEXT_PUBLIC_ON_VERCEL` (injetado
  pelo `next.config`). Variáveis *sensitive* da Vercel **não existem no build**
  — toda leitura de env de segredo é em tempo de chamada (`stripeConfigured()`,
  `conf()` no mailer). Não voltar a ler `process.env` no topo do módulo.
- **Fotos**: a base aberta (Open Food Facts) foi **esgotada** — 42 produtos não
  têm foto de estúdio em acervo aberto nenhum, e a Open Beauty Facts tem zero
  Gillette/Oral-B/sabão em pó do Brasil. Recorte automático de fundo é ~50 %
  destrutivo nesse acervo (medido, duas vezes, dois modelos) — só item a item,
  com o olho. O caminho que escala é **kit de mídia do fornecedor**
  (`docs/emails-fornecedores.md`) ou foto própria. Nunca raspar pack shot de
  site de marca: é obra protegida de quem precisamos como fornecedor.
- **Farmácia fora**: Lei 5.991/73 art. 6º — dispensação de medicamento é
  privativa de farmácia/drogaria. O kit "First-need pharmacy" fica desligado
  até virar kit de primeiros socorros **sem medicamento** (curativo, gaze,
  antisséptico, luva, tesoura).
- **Marca é do fabricante**: eSIM e kits não têm marca (a loja não é marca de
  mercadoria). A chave de sincronização do line-up faz `upper()` ANTES de
  `translate()` — nome acentuado em caixa mista duplicava navio.
- **Admin sem `service_role`**: tudo passa por RLS + RPCs guardadas por
  segredo ou `is_admin()`. `ops_health()` é a única porta para `cron.*`.

## Estado do catálogo

131 produtos, **118 ativos** (Food & Drinks 81 · Beauty & Health 31 ·
Connectivity 6), 0 com preço, variante ou caminho de foto vazio. 13 desligados
por foto ruim ou regulação. Lista completa com situação de cada foto:
`docs/fotos-pendentes.csv`.

Auditoria de **2026-09-02** achou cinco caminhos de foto que não existiam em
`public/produtos/` (404 em produção). Em **2026-09-04** quatro foram repostos do
acervo aberto pelo mesmo portão de qualidade e molde de 1000 px
(`EAN-7896005801819`, `EAN-7891000286449`, `EAN-0079656049718`, `EAN-42467045`);
o quinto, `EAN-0079656026078` (Banana Boat SPF 50), só tinha no acervo um spray
Kids desfocado — produto **desligado** até chegar foto de verdade.

`track_stock` está **false** nas 131 variantes (119 com `stock_qty = 0`). O
mecanismo de estoque está armado; ligar é por produto, no admin, quando houver
estoque físico de verdade.

## Pendências (em ordem)

1. **Rotacionar segredos colados no chat**: senha da caixa `help@atgangway.com`,
   senha do banco Supabase, token da Vercel. Depois de rotacionar, atualizar
   `SMTP_PASS` na Vercel. **Precisa do Gustavo**: o MCP da Hostinger troca a
   senha da caixa, mas nenhum MCP escreve variável de ambiente na Vercel (o
   conector da Vercel devolve 403 até para ler o projeto) — trocar a senha
   sem pôr a nova na Vercel derruba o digest diário. Ordem certa: gerar a
   senha nova no painel da Hostinger → colar em `SMTP_PASS` na Vercel →
   redeploy → conferir `sent:true` no digest.
2. **Stripe live**: chave `sk_live_` em `STRIPE_SECRET_KEY` na Vercel e um
   webhook **live** apontando para `https://atgangway.com/api/stripe/webhook`
   (hoje o modo live tem zero webhooks; o de teste foi corrigido em
   2026-09-03 — apontava para `www.marinerssupplyco.com`, que responde 404).
   O signing secret do endpoint live vai em `STRIPE_WEBHOOK_SECRET`.
3. **Fotos**: mandar `docs/emails-fornecedores.md` (22 grupos, 43 SKUs) e/ou fotografar;
   ao receber, `scripts/normalizar-fotos.mjs` põe no molde de 1000 px. Depois
   religar os 8 produtos desligados por foto.
4. **Primeira necessidade** (lâmina, escova, xampu, sabão em pó, repelente,
   adaptador NBR 14136): preço a 5×, régua pronta — travado só na foto.
5. Hostinger: há um pedido de e-mail **pago e sem domínio** (`pending_setup`,
   criado 2026-08-23) e a caixa de `marinerssupplyco.com` ainda ativa —
   decidir se cancela. Opcionalmente tirar `marinerssupplyco.com` dos
   domínios autorizados do Google OAuth.

## Concluído nesta continuação

- **2026-09-02:** `middleware.ts` → `proxy.ts`, com o export exigido pelo
  Next 16 e sem mudar o matcher nem a lógica de sessão, autenticação e gate
  de cadastro. O teste `tests/proxy.test.mjs` impede a convenção legada de
  voltar silenciosamente.
- **2026-09-03 — Supabase**: o projeto já se chama `atgangway` e é o único da
  conta; o projeto vazio `ruaqthduxwrvjinmvkzb` não existe mais.
- **2026-09-03 — Roadmap T2 (conversão)**: janela de entrega no herói da home
  para quem não tem navio na conta (mesma tira de `/ports`, grade em cache de
  300 s, promessa resolvida por requisição); filtro de marca no celular
  (`components/BrandSelect.tsx`, some a partir de 1024px onde o trilho
  responde); `herofacts` compacto no mobile; MiniCart com foco preso (Tab
  circula, Esc fecha, foco volta ao botão do carrinho) e região `aria-live`
  com contagem e subtotal.
- **2026-09-03 — Stripe (teste)**: URL do webhook corrigida para `atgangway.com`.
- **2026-09-03 — Picker de navio só oferece escala aberta** (relato do
  Gustavo: "ainda deixa selecionar navio que já fechou"). `search_vessels` e
  `create_vessel` passaram a usar a régua do banco (`eta - cutoff_hours >
  now()`), e as Server Actions da conta recusam trocar para escala fechada.
  pgTAP em `supabase/tests/escala.sql` (5 invariantes). Migração
  `20260903040000_busca_de_navio_so_escala_aberta.sql`, aplicada.

### Feitas em 2026-09-04

- **Performance (fase 1)**: functions da Vercel em `gru1` (estavam em Washington
  falando com banco em São Paulo — cada consulta cruzava o oceano); sessão
  verificada localmente pelo JWT (`lib/supabase/session.ts`, `getClaims`) em
  vez de `getUser()` em toda requisição; selo de favoritos vivo no navegador
  (`lib/wish.tsx`) em vez de `revalidatePath("/", "layout")` a cada coração.
- **Painel novo** (`/admin`, em português): login próprio em `/admin/login`
  (só e-mail + senha; usuário `help@atgangway.com` criado como admin, senha
  enviada para a própria caixa); barra lateral no desktop e abas embaixo no
  celular (`components/admin/AdminShell.tsx`); pedidos em tabela com painel de
  detalhe e ações otimistas com Desfazer (`components/admin/PedidosBoard.tsx`);
  confirmação em cancelar/creditar; navios em três pilhas com edição em
  painel; catálogo e compras no mesmo sistema; `/admin/products` (v1) removido.
  As actions devolvem a linha nova (`lib/painel.ts` → `Resultado<T>`) em vez de
  revalidar a página inteira.
- **Alertas de atraso**: tabela `admin_notifications` + RPC `notify_admin`
  (migração `20260904040000_admin_notifications.sql`); o cron do line-up
  (`lib/alertas.ts`) avisa no sino do painel e por e-mail para
  `help@atgangway.com` quando navio publicado escorrega ≥ 6 h ou navio com
  pedido aberto muda ≥ 2 h. Dedupe por navio + ETA novo.
- **Área do cliente**: barra de abas fixa embaixo no celular
  (`components/AccountTabs.tsx`); o rail lateral só a partir de 1024px.
- **Fotos**: 4 repostas do acervo aberto, Banana Boat SPF 50 desligado (118 ativos).

## Como verificar que está tudo vivo (5 min)

```
curl -s -o /dev/null -w '%{http_code}\n' https://atgangway.com/shop      # 200
curl -s https://atgangway.com/shop | grep -o 'class="count">[^<]*<'      # "119 products"
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://atgangway.com/api/cron/daily  # 401 (guarda viva)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://atgangway.com/admin      # 307 → /admin/login?next=/admin
curl -sI https://atgangway.com/shop | grep -i x-vercel-id                                # ...::gru1::... (function em SP)
# digest diário = caminho real de e-mail; sent:true prova o SMTP
curl -s -H "Authorization: Bearer <app_secrets.cron_secret>" https://atgangway.com/api/cron/daily
# invariantes de dinheiro, no banco, com rollback
psql "$DATABASE_URL" -f supabase/tests/dinheiro.sql                       # 11 × "ok"
# (ou colar o arquivo inteiro no execute_sql do MCP do Supabase — mesma saída)
# crons: última execução de cada job, direto no banco
#   select jobname, status, start_time from cron.job j
#   join lateral (select * from cron.job_run_details r where r.jobid=j.jobid order by start_time desc limit 1) d on true;
```

No painel (`/admin`, conta com `profiles.role = 'admin'`), a faixa de saúde no
topo diz em vermelho se o line-up parou, o PTAX envelheceu ou um cron falhou.
