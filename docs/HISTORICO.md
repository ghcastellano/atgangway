# At Gangway — passagem de bastão

> Para quem abre um chat novo em `github.com/ghcastellano/atgangway` e precisa
> do contexto sem esta sessão. Estado em **2026-09-02**. Tudo o que está aqui
> foi verificado contra produção, não relembrado.

## O que é

Loja de ship supply para tripulações de navios atracados no **Porto de
Santos**. Next.js 15 (App Router, Server Actions) + Supabase (Postgres, RLS,
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
| deploy | Vercel, projeto `atgangway`, produção em `atgangway.com`; cada push em `main` publica |
| banco | Supabase `cuaocjxofaizefzcxlyc`; migrações aplicadas via MCP e **documentadas** em `supabase/migrations/` (o repositório é registro, o banco é a verdade) |
| tipos do banco | `lib/database.types.ts` — gerado; regenera com `supabase gen types` ou o MCP |
| testes | `npm test` (Node test runner, ~250; os responsivos precisam de servidor local) e `supabase/tests/dinheiro.sql` (pgTAP, 11 invariantes de dinheiro) |
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

131 produtos, **119 ativos** (Food & Drinks 81 · Beauty & Health 32 ·
Connectivity 6), 0 com preço, variante ou caminho de foto vazio. 12 desligados
por foto ruim ou regulação. Lista completa com situação de cada foto:
`docs/fotos-pendentes.csv`.

Auditoria local em **2026-09-02** encontrou cinco caminhos preenchidos que não
existem em `public/produtos/` e também respondem 404 em produção:
`EAN-7896005801819`, `EAN-7891000286449`, `EAN-0079656049718`,
`EAN-0079656026078` e `EAN-42467045`. Os produtos continuam ativos; as fotos
não foram improvisadas nem copiadas de sites de marca por causa da decisão de
licença acima.

`track_stock` está **false** nas 131 variantes (119 com `stock_qty = 0`). O
mecanismo de estoque está armado; ligar é por produto, no admin, quando houver
estoque físico de verdade.

## Pendências (em ordem)

1. **Rotacionar segredos colados no chat**: senha da caixa `help@atgangway.com`,
   senha do banco Supabase, token da Vercel. Depois de rotacionar, atualizar
   `SMTP_PASS` na Vercel.
2. **Stripe live**: trocar `sk_test_` por chave live e reapontar o webhook.
3. **Fotos**: repor primeiro os cinco arquivos ativos com 404 listados acima;
   mandar `docs/emails-fornecedores.md` (22 grupos, 43 SKUs) e/ou fotografar;
   ao receber, `scripts/normalizar-fotos.mjs` põe no molde de 1000 px. Depois
   religar os 8 produtos desligados por foto.
4. **Primeira necessidade** (lâmina, escova, xampu, sabão em pó, repelente,
   adaptador NBR 14136): preço a 5×, régua pronta — travado só na foto.
5. **Renomear** o projeto Supabase para `atgangway` e apagar o projeto vazio
   `ruaqthduxwrvjinmvkzb`; opcionalmente tirar `marinerssupplyco.com` dos
   domínios autorizados do Google OAuth.
6. Roadmap T2 (conversão): janela de entrega na home para deslogado, filtro de
   marca no celular, `herofacts` no mobile, MiniCart com focus trap/`aria-live`.

## Concluído nesta continuação

- **2026-09-02:** `middleware.ts` → `proxy.ts`, com o export exigido pelo
  Next 16 e sem mudar o matcher nem a lógica de sessão, autenticação e gate
  de cadastro. O teste `tests/proxy.test.mjs` impede a convenção legada de
  voltar silenciosamente.

## Como verificar que está tudo vivo (5 min)

```
curl -s -o /dev/null -w '%{http_code}\n' https://atgangway.com/shop      # 200
curl -s https://atgangway.com/shop | grep -o 'class="count">[^<]*<'      # "119 products"
# digest diário = caminho real de e-mail; sent:true prova o SMTP
curl -s -H "Authorization: Bearer <app_secrets.cron_secret>" https://atgangway.com/api/cron/daily
# invariantes de dinheiro, no banco, com rollback
psql "$DATABASE_URL" -f supabase/tests/dinheiro.sql                       # 11 × "ok"
```

No painel (`/admin`, conta com `profiles.role = 'admin'`), a faixa de saúde no
topo diz em vermelho se o line-up parou, o PTAX envelheceu ou um cron falhou.
