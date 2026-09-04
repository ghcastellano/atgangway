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

### Ainda em 2026-09-04 — desempenho medido e acerto de interface

- **Leitura do relatório de queries** (`pg_stat_statements`, janela de 8 dias):
  não havia query lenta, havia repetição. `list_products` 58×/h,
  `category_counts` 48×/h, `brands`+`categories` ~45×/h cada — a vitrine
  refeita a cada visita porque `/shop` e `/c` abriam o client com cookie,
  o que tira a página do cache. `lib/vitrine.ts` põe as quatro em
  `unstable_cache` (client anônimo, tag `catalog`, 300 s). Medido: `/shop`
  441 ms frio → 22 ms em cache.
- **`sync_ship_etas`** (migração `20260904050000`): o cron chamava
  `sync_ship_eta` uma vez por navio (~92×/h, 18 mil na janela). Agora manda
  a lista inteira numa chamada e o banco itera. Rodada das 05:00 UTC de
  2026-09-04: 98 navios, 0 falhas.
- **Status do pedido do cliente**: havia uma régua PARALELA na página do
  pedido (quatro marcos, outros rótulos) que divergia do painel —
  `awaiting_deposit` acendia "Deposit received", `deposit_paid` acendia
  "We shop & pack". Agora o passo vem de `orderStep()` sobre o mesmo
  `ORDER_FLOW` do painel, com os rótulos de `STATUS_LABEL`. E
  `revalidatePath("/orders")` não alcançava `/orders/<code>`: as duas rotas
  são revalidadas.
- **Coração no celular**: uma regra escondia conta E favoritos abaixo de
  768px. A conta continua na gaveta; o ♡ voltou ao cabeçalho.
- **Auditoria de layout no navegador** (14 páginas × 360/390/768/1024/1440),
  medindo estouro lateral, sobreposição, blocos colados e alvos de toque.
  Corrigidos: barra da listagem (grade de duas linhas no celular), rodapé,
  trilha, links legais, olho da senha, KPIs e fita de filtros do painel,
  popover de avisos. Resultado final: zero estouros, zero sobreposições.
- **Vercel Web Analytics**: `@vercel/analytics` instalado e no bundle;
  `/_vercel/insights/script.js` responde 200. **Falta ativar no painel**
  (Analytics → Enable) para os dados aparecerem — é o plano gratuito.
  O conector MCP da Vercel devolve 403 de escopo, então não dá para ler os
  números nem ativar daqui.
- **Público real em 2026-09-04**: 2 contas (as duas de staff), 1 pessoa com
  pedido, 6 pedidos, US$ 818,50, 9 favoritos. Não há cliente de fora ainda;
  todo o movimento nas métricas do banco é build, teste e robô.

### Métricas na Vercel (2026-09-04)

`@vercel/analytics` (visitas) já estava no layout. Somou-se
`@vercel/functions` → `metric()` para os números de OPERAÇÃO, com o
helper `lib/metricas.ts` (`medir` e `cronometrar`). Fora do runtime da
Vercel a função é no-op — nenhuma requisição em `npm run dev`, `npm test`
ou build local.

| métrica | tags | o que responde |
|---|---|---|
| `vitrine.miss_ms` | `consulta`, `tipo`, `desfecho` | quantas vezes o cache do catálogo NÃO segurou, e quanto custou a ida ao banco |
| `vitrine.itens` | `tipo` | tamanho da página devolvida |
| `pedido.rpc_ms` | `desfecho` | duração do `place_order` |
| `pedido.tentativa` | `resultado` | `criado`, `duplicado`, `out_of_stock`, `no_window`, `falha_rpc`… |
| `pedido.deposito_usd` / `pedido.saldo_usd` | — | dinheiro que entra agora e na escada |
| `lineup.sync_ms`, `lineup.navios`, `lineup.mudancas_eta`, `lineup.alertas`, `lineup.falhas` | — | saúde do cron de hora em hora |
| `email.envio_ms` | `resultado` | se o e-mail saiu, e em quanto tempo |

**Regra das tags**: só conjunto fechado de valores. Nada de id, nome de
navio, e-mail ou termo de busca — cardinalidade alta vira fatura e um
gráfico de dez mil séries que ninguém lê.

**Falta ativar no painel**: Web Analytics (a API confirma
`web_analytics_not_enabled`) e, para ver as métricas customizadas,
Observability. O código não cobra nada sozinho; a cobrança, se houver,
vem do que for ligado no painel — confira o plano antes de ativar.

### Teto de desempenho encontrado em 2026-09-04 (não corrigido — decisão do Gustavo)

Medindo produção depois do deploy das métricas, o piso ficou em ~350 ms
e o pico em 1,5 s. A investigação achou a causa, e ela **não** é o banco:

- `/faq` (texto puro, nenhuma consulta) e `/shop` (catálogo inteiro) têm
  **o mesmo tempo** — 0,35 s as duas. Isso PROVA que o cache do catálogo
  de `lib/vitrine.ts` está segurando: a página que consulta não custa
  mais que a que não consulta.
- Mas as duas respondem `x-vercel-cache: MISS` e
  `cache-control: private, no-cache, no-store`. E no build, das 43 rotas,
  só 6 são estáticas — e as 6 são assets (ícone, manifest, robots,
  sitemap). **Toda página HTML é dinâmica**, inclusive `/faq`.

Causa: o layout raiz renderiza `SiteChrome`, que lê cookie para saber se
há sessão. No App Router, um layout que usa `cookies()` marca a árvore
INTEIRA como dinâmica — o `export const revalidate = 300` de `/shop` e
`/c/[slug]` não vence isso. Nenhuma página é servida do CDN; toda visita
executa a função em gru1, e os ~350 ms são o custo dessa execução.

Caminho de correção (Next 16): PPR — a casca da página vira estática e
o cabeçalho fica num `<Suspense>` dinâmico. Alternativa: `SiteChrome`
virar componente de cliente que busca a sessão por uma rota de API.

**Por que NÃO foi feito agora**: mexe no layout raiz, afeta as 43 rotas,
e o ganho hoje é zero — não há visitante. Vale fazer quando houver
tráfego real, com uma medição antes e depois.

> **Feito em 2026-09-04** — pela segunda alternativa, não pela primeira.
> Ver a seção "o teto caiu" no fim deste arquivo.

### 2026-09-04 — o filtro que não podia dar certo, e o acabamento

Relato do Gustavo: "New Arrivals + Promo não traz nada, mas tem produto
em promoção". Não era dado faltando — era um filtro **impossível por
construção**:

- `badge` é UMA coluna por produto. New Arrivals É a coleção de
  `badge='new'` (14 produtos, todos com esse selo). Pedir `badge='promo'`
  ali dentro nunca pôde devolver nada, e a tela oferecia mesmo assim.
- Correção: RPC `badge_counts(categoria, marca, busca)` +
  `contagensPorSelo` em `lib/vitrine.ts`. A tela agora mostra **só o selo
  que tem resultado, com o número**: em New Arrivals aparece "New 14"; na
  loja toda, "Promo 1 · New 14". Filtro que devolve zero deixou de existir.

Outros defeitos corrigidos na mesma passada:

| defeito | estava | ficou |
|---|---|---|
| WhatsApp do rodapé | `wa.me/<num>` — abria conversa EM BRANCO | `?text=` com mensagem pronta dizendo de onde veio |
| marca no rodapé | "Vessel **Supplier**" (nome antigo!) | "At **Gangway**" |
| `/ports` em 1920px | 26% da tela; texto e tabela numa coluna de 500px | 40% — `--read-w: 760px`, coluna de leitura de verdade |
| `/ports` em tablet | 65% | 99% |
| nome do produto | 13.5px | 15px |
| marca / unidade / apoio | 9.5px / 11px / 11.5px | 11px / 12.5px / 13px |
| vão no card | ~36px de buraco entre nome e preço (duas linhas reservadas que ficavam VAZIAS) | reserva só no nome, que é onde a variação existe |
| barra de filtros no celular | grade de 2 colunas de quando os chips eram só de desktop — atropelava tudo | três faixas: contagem / chips / selects |

Medido em 390, 768, 1440 e 1920px: zero estouro lateral em tudo; textos
abaixo de 13px no /shop caíram de 53 para 38; alvos de toque menores que
40px, de 51 para 34 no celular e de 27 para 12 no tablet.

**O que NÃO foi feito** e o Gustavo pediu: o passe estético geral
(hierarquia da home, peso dos CTAs na grade, lista de marcas sem fim no
trilho, tratamento das fotos brancas sobre tema escuro). É trabalho de
design, não de correção, e precisa de direção antes do código.

### 2026-09-04 — a loja virou CLARA (e o que isso revelou)

Decisão, com o motivo: escuro é o regime de joalheria, áudio e jogo.
Quem vende mantimento — Amazon, iFood, Zé, Ocado, Waitrose — é claro, e
não por moda: foto de supermercado vem em fundo branco, e sobre um fundo
quase preto cada card virava um retângulo de 20:1 gritando na tela.
Fora que o cliente lê no convés, no sol.

Como foi feito, sem reescrever componente nenhum: a paleta inteira mora
em tokens no `:root`, então bastou redefini-los. **Cabeçalho, rodapé e o
painel `/admin` continuam escuros** redefinindo os MESMOS tokens no
próprio escopo (`.sunhead`, `.sunfoot`, `.adm`) — todo o CSS de dentro
deles segue valendo palavra por palavra. O azul-noite não sumiu: virou a
tinta (`--ink`) e a cor dessas três superfícies.

O que a virada obrigou a consertar, e que estava errado ou escondido:

| o quê | por quê |
|---|---|
| `--amber` deixou de ser cor de TEXTO | 2:1 sobre branco. Virou exclusivamente fundo de ação; `--amber-hi` (queimado, 4.9:1) carrega o destaque em texto. Os pares do teste de contraste foram atualizados para medir o uso REAL |
| `--faint` e `--wa` escurecidos | davam 4.1:1 e 3.1:1 no branco — o teste `cores.test.mjs` pegou as duas |
| tira do CORTE (`.deadline`) | urgente era rosa `#FFC2C7`, escolhido para fundo escuro: **ilegível** no claro. É a informação mais cara da loja — depois dela o navio parte sem a encomenda |
| `.alert` e `.note` | mesma origem |
| cards | no escuro se separavam pela cor; no claro precisam de elevação — sombra + fio, e o painel da foto um degrau abaixo do branco do card, senão a foto não tinha limite |

**Bug grave achado no checkout, e corrigido.** A leitura dos preços era
`.then()` sem `.catch()`. Pior: o builder do Supabase devolve um
`PromiseLike`, que **não tem** `.catch` — não havia como pegar a
rejeição. E no wifi de bordo a conexão raramente recusa: ela PENDURA, e
aí a promessa nunca resolve nem rejeita. Resultado: a tela de pagamento
girava um círculo **para sempre**, sem mensagem, sem botão, sem saída.
Agora: `async/await`, `AbortController` com 12 s, e um estado de falha
com o que aconteceu ("nada foi cobrado, seu carrinho está salvo"),
"Try again" e volta para o carrinho. O saldo de crédito ganhou o mesmo
tratamento com 8 s — ali a falha é benigna e não pode derrubar a compra.

254 testes passam, incluindo os de contraste sobre a paleta nova.

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

## 2026-09-04 — o teto caiu: a casca do site parou de ler cookie

O teto documentado acima (todas as rotas dinâmicas, `x-vercel-cache:
MISS` até em `/faq`) foi derrubado. A causa era a que estava escrita:
`SiteChrome`, no layout raiz, lia cookie para saber se havia sessão.

**O caminho que NÃO deu**: PPR. No Next 16.3 o `experimental.ppr` foi
absorvido pelo `cacheComponents`, que é booleano — não existe modo
incremental. Ligá-lo obrigaria a migrar as 43 rotas para `"use cache"`,
`cacheLife` e `cacheTag` de uma vez, e a trocar todos os
`export const revalidate`. Cheguei a escrever a versão com
`ppr: "incremental"`; o build recusou com a mensagem da mudança. Reverti
em vez de forçar: uma migração dessas não se faz junto com outra coisa.

**O caminho que deu**: o documento passa a ser idêntico para todo
visitante, e a personalização chega por fora.

- `app/api/sessao/route.ts` responde `{ logado, count, ids }` — sessão,
  contagem de favoritos e quais produtos estão na lista. Cabeçalhos
  `private, no-store`: uma resposta destas vazando para o cache mostraria
  a lista de desejos alheia.
- `components/SessaoSeed.tsx` é componente de cliente, busca isso depois
  da tela pintada, com `AbortController` de 8 s (wifi de navio pendura em
  vez de recusar) e, se falhar, assume deslogado — ficar em "não sei"
  deixaria o menu da conta sem decidir para sempre.
- `lib/wish.tsx` deixou de ser só o contador: guarda `count`, `ids` e
  `logado`. `logado` nasce `null` e o menu mostra um item neutro até
  saber — desenhar "Sign in" no escuro faria quem TEM sessão achar que
  caiu.
- `wishedProductIds()` saiu da home, de `/shop`, `/c/[slug]` e
  `/p/[slug]`. `WishButton` decide pelo contexto; `initial` continua
  existindo só para `/wishlist`, onde a página sabe mesmo.
- `/ports`, `/attributions` e `/p/[slug]` liam catálogo público com o
  cliente de sessão. Passaram a usar `lib/supabase/publico.ts`, que não
  toca em `cookies()`.
- `generateStaticParams` na ficha de produto. **Este foi o detalhe que
  custou uma medição**: mesmo sem cookie em lugar nenhum, rota com
  segmento dinâmico e sem `generateStaticParams` o Next trata como
  totalmente dinâmica — `/p/x` continuava com `private, no-store`. São
  500 slugs no build; o resto e todo produto novo continuam sendo
  gerados na primeira visita, porque `dynamicParams` segue `true`.

Medido no build de produção, servindo local:

| rota | antes | depois |
|---|---|---|
| `/faq` | MISS, ~350 ms | `x-nextjs-cache: HIT`, **4 ms** |
| `/ports` | MISS | HIT, **11 ms** |
| `/attributions` | MISS | HIT |
| `/p/<slug>` | MISS | HIT, **15 ms** |
| `/shop`, `/c/<slug>` | MISS | segue dinâmica (usa `searchParams`) |
| `/` | MISS | segue dinâmica (por decisão, abaixo) |

No build: 15 rotas HTML estáticas mais 130 fichas de produto, contra 6
assets antes.

**O que continua dinâmico, e por quê.** `/shop` e `/c/[slug]` leem
`searchParams` — no App Router isso é dinâmico e não tem volta sem
`cacheComponents`. Custa pouco: o catálogo delas já está em
`unstable_cache`. A **home** ficou de fora por decisão de UI, não por
limitação: a janela de entrega, os três passos do herói, o painel da
escala e a faixa do Captain estão costurados no meio da primeira dobra,
e servir casca guardada preenchendo depois faria a página mais vista da
loja saltar na frente da pessoa. Conteúdo que pula é o que faz um site
parecer barato — e era exatamente a queixa que abriu este trabalho.

**Custo honesto da troca**: cada carregamento completo passa a fazer uma
chamada a `/api/sessao`. É uma função pequena (JWT conferido localmente,
e sem sessão nem toca no banco) contra a página INTEIRA que era função
antes. Continua sendo troca boa, mas não é "de graça".

### O que sobrou do tema escuro

A inversão para o tema claro deixou três valores para trás, todos fora
do CSS — por isso os testes de contraste não os pegaram:

- `viewport.themeColor` estava `#01060D`. É a faixa que o celular pinta
  na barra de status antes de qualquer conteúdo aparecer. Agora
  `#E9EEF4`, que é o fundo REAL do `<body>` (conferido no navegador —
  `--abyss`, não o `--night` que eu supunha).
- `viewport.colorScheme: "dark"` era o pior dos três porque é funcional:
  manda o sistema desenhar `<select>`, campo de data e barra de rolagem
  em modo escuro. O checkout tinha caixas pretas entre cartões brancos.
- `appleWebApp.statusBarStyle: "black-translucent"` desenha relógio e
  bateria em BRANCO sobre o conteúdo. Sobre fundo claro, somem. Virou
  `"default"`.
- `manifest.ts` (`background_color`/`theme_color`) e `global-error.tsx`
  (que não tem CSS, por definição) também estavam escuros.

## 2026-09-04 — o acabamento: o que o teste de cores não via

O tema claro tinha sido invertido nos TOKENS, e os testes conferiam
pares de tokens que eu escolhi à mão. Passavam. O site continuava com
defeitos visíveis, porque o problema não estava nos tokens: estava em
quarenta lugares que nunca usaram token nenhum.

### A ferramenta antes das correções

`scripts/auditar-contraste.mjs` (`npm run audit:contraste <url>`) mede o
site RENDERIZADO: para cada texto visível, a cor computada contra o
fundo efetivo — subindo a árvore e compondo camadas translúcidas, que é
o que o olho vê. Roda 19 rotas em duas larguras.

Primeira execução: **20 regras abaixo do AA**, nenhuma delas coberta
pelo teste de tokens. A raiz era uma só, repetida: `--amber` usado como
TINTA. Ele é cor de FUNDO — 2,15:1 sobre branco. `--amber-hi` (#A85E00,
4,8:1) é a versão legível, e existe desde a inversão; o CSS é que não
tinha sido atualizado. Estavam assim, entre outros:

- o número do CORTE no painel da escala (`.vpanel .corte strong`), que é
  o dado mais importante da tela mais importante para quem já comprou;
- o `−`/`+` do contador do carrinho;
- "Browse all ›", o kicker do herói, os números 01/02/03;
- o nome do produto no título da descrição da ficha.

A troca foi mecânica e segura porque as superfícies escuras (cabeçalho,
rodapé, painel, barra de compra) redefinem `--amber-hi` como
`--amber-on-dark` no próprio escopo — o mesmo `var(--amber-hi)` resolve
para o âmbar claro lá dentro. Exceções mantidas à mão: os logotipos
sobre escuro, onde o âmbar cheio é identidade e já passa folgado.

Depois: **0 regras abaixo do AA**.

### Cores do tema escuro que sobraram fora dos tokens

Não eram cor de texto, então nenhum teste as via:

- **43** usos de `rgba(255,182,72,…)` — o âmbar da loja ESCURA, morto na
  inversão. Anéis de foco, bordas de hover, lavagens de destaque: cada
  um invisível sozinho, todos juntos fazendo um site em que o realce
  nunca é exatamente a cor do botão. Viraram `rgba(var(--amber-rgb),…)`.
- **13** usos de `rgba(46,230,200,…)`, o teal neon. Mesma história,
  agora `--teal-rgb`.
- `.cta-dock`: gradiente até `rgba(1,6,13,.9)` — preto a 90% — no pé da
  ficha de produto. Sobre o papel claro virava uma faixa preta que
  **comia o preço** logo acima dela, na tela em que se decide a compra.
- `.buydock` (a barra fixa de comprar): fundo escuro com `.nm` em
  `var(--ink)`. O NOME DO PRODUTO estava invisível — sobravam a
  miniatura, um preço e um "Add" sem objeto. Corrigido pela mesma
  técnica do cabeçalho: redefinir os tokens no escopo.
- `.capcode`: o código de indicação numa caixa escura translúcida dentro
  de um cartão branco.
- `.proof-thumb span`: tarja sobre foto com tinta `--muted`, que na
  inversão virou cinza-escuro sobre escuro.
- `.payopt input { accent-color: #FFB648 }` no rádio de pagamento.
- `viewport.colorScheme: "dark"`, que mandava o sistema desenhar
  `<select>` e barra de rolagem escuros — caixas pretas no meio do
  checkout claro.

### Hierarquia: quatro botões âmbar não são hierarquia

`.padd` (o "Add to cart" da grade) era âmbar sólido. Numa fileira de
quatro cards isso vira uma cerca laranja atravessando a vitrine: a coisa
mais forte da tela passa a ser o botão repetido, não o produto. Virou
tonal — lavagem de âmbar, anel de âmbar, tinta `--ink` — e preenche
sólido no hover e no foco. O âmbar cheio fica para onde existe UMA ação:
a ficha, o carrinho, o checkout. Efeito colateral bom: o contador `−/+`
de um item JÁ no carrinho é agora o único âmbar cheio da grade, e marca
sozinho o que a pessoa escolheu.

A tinta é `--ink` e não `--amber-hi` porque âmbar escuro sobre lavagem
de âmbar dá 4,45:1 — reprova por pouco, e "por pouco" numa etiqueta de
13px é exatamente onde a vista cansada para de ler.

### Números que se contradiziam na mesma tela

- `/shop` dizia "**1 sections**" em Connectivity: plural errado, e
  contava SUBCATEGORIAS enquanto o trilho ao lado contava produtos. Dois
  números para a mesma categoria, na mesma página. Agora é um só, e é o
  que o clique devolve.
- `/c/[slug]` dizia "24+ items" (o tamanho da página) enquanto o trilho
  dizia "Food & Drinks 81". Agora mostra o total da subárvore, e só troca
  para o número do resultado quando há filtro aplicado.

### O trilho de marcas era um índice de fornecedor

Listava TODAS as marcas, em ordem de cadastro, sem número e sem fim: em
1920px passava da dobra. Agora `marcasEmUso` devolve a contagem por
marca e ordena por ela; o trilho mostra oito e guarda o resto atrás de
"N more brands" (`<details>` nativo, sem JavaScript). A marca ATIVA
entra sempre na lista visível, mesmo que seja a trigésima — filtro ligado
escondido dentro de um acordeão fechado é filtro que não se desliga.

### O painel "How it works" com um terço vazio

A altura vem do herói ao lado; a sobra caía toda no fim, uns 250px de
branco no bloco mais visto da loja. Encher com decoração seria pior. O
que faltava de verdade era o CANAL: quem nunca comprou de um chandler
não pede rancho por formulário sem falar com alguém, e o WhatsApp estava
no rodapé, onde ninguém que ainda está decidindo chega. O pé do cartão
agora traz "Ask on WhatsApp" e o e-mail. O número saiu do rodapé para
`lib/env` (`whatsappLink`) — número em dois lugares um dia diverge, e
este é o canal do socorro na véspera de atracar.

### O carrinho girava para sempre

Achado sem querer: o navegador do sandbox não tem internet, o que
reproduz o wifi de bordo com fidelidade cruel. `/cart` ficava com um
spinner no meio de uma página em branco, indefinidamente.

Era o MESMO defeito que o checkout tinha e que já havia sido corrigido
lá: `.then()` sem par, e o builder do Supabase devolve um `PromiseLike`
que nem sequer tem `.catch`. Sem `abortSignal`, a conexão de navio não
recusa — ela pendura, e não existe erro para capturar.

Corrigidos com teto de tempo, `try/catch` e uma saída honesta:

- `/cart` (12 s) — "We couldn't load your cart · Nothing was lost — your
  N items are still saved on this device" + "Try again" e "Keep browsing";
- `MiniCart` (8 s) — a gaveta dizia nada e girava por cima da vitrine;
- as três leituras acessórias do carrinho (mínimo do porto, saldo de
  crédito, escala do perfil), que eram `.then()` sem par: agora falham
  em silêncio para o valor neutro, sem rejeição sem dono;
- `/signup` — sem os selects, "posto" e "porto" ficavam em "Loading…"
  para sempre, o que lê como formulário quebrado. Agora diz que falhou;
- `/reset-password` — idem no `getUser()`.

### Miúdo

- `.pbadge.new`: #04231E sobre `--teal` dava 3,25:1. Branco dá 5,1:1.
- `.share` (o botão que espalha o código do Captain): #04240F sobre o
  verde do WhatsApp, 3,4:1. Branco dá 4,8:1.
- `.catgrid` fechava em 3 + 1 no tablet, com um vazio do tamanho de um
  cartão. Duas regras concorriam (560px → 3 e 620px → 2) e vencia a
  errada; ficou a escada 1 → 2 → 3.
- No card, o preço encosta no nome e quem ancora no rodapé é o BOTÃO.
  Era o contrário, e alinhava os preços da fileira à custa de ~100px de
  branco dentro dos cards de nome curto. A linha do botão é a que o olho
  vê, porque é a peça pesada.

### A gaveta, e por que a auditoria agora abre o que nasce fechado

Um dia inteiro com a marca da loja ilegível no primeiro elemento da
gaveta de categorias: `.sunlogo .l2` é âmbar cheio — certo sobre o
azul-noite do cabeçalho, 2,15:1 sobre o papel branco da gaveta. Eu tinha
excluído `.sunlogo` da varredura justamente por causa do cabeçalho, sem
notar que o mesmo componente aparece em duas superfícies.

A auditoria não pegou porque a gaveta nasce fechada. **Painel que não se
abre é painel que não se testa** — então ela passou a abrir, medir e
fechar os três: gaveta de categorias, gaveta do carrinho e menu da
conta.

E foi validada como se valida um teste: reintroduzi o defeito de
propósito, confirmei que ela reprova (`2.15:1 … .l2 … "Gangway"`), e só
então restaurei a correção. Teste que nunca falhou não é teste, é
decoração.

De quebra, a gaveta ganhou "Need a hand? WhatsApp us" acima do botão do
carrinho: eram uns 240px de branco abaixo do último item do menu, e quem
abre a gaveta procurando por onde falar com a loja não achava nada.

### Faixas de controle antes do primeiro produto

No celular, `/shop?q=coffee` mostrava, nesta ordem: migalha, título,
"13 results", chip "New 1", dois selects e um chip `Search "coffee" ×`.
Seis blocos antes do primeiro produto, numa tela de 844px.

- O chip da busca saiu: dizia o que a migalha, o título e a caixa de
  busca do cabeçalho já diziam — a mesma palavra quatro vezes. Selo e
  marca ficam, porque chega gente por link com `?badge=`.
- Contagem e chips voltaram para a MESMA faixa (cada um tinha
  `flex: 1 1 100%` e uma linha só para si).
- Os dois selects ficam juntos na faixa de baixo. A quebra de linha é
  feita pelo rótulo "Sort by", com base 100% e altura zero: no celular
  ele é invisível e serve de quebra, no desktop volta a ser rótulo e a
  barra cabe numa linha só. Sem a parte do desktop, "Featured" descia
  sozinho — regressão que só apareceu porque conferi as três larguras
  depois de mexer numa.

De seis blocos para quatro. Os produtos começam ~120px mais acima.

### O texto que piscava, e a auditoria que passou a ler a regra

A faixa "LAST CALL — Order in the next 2h" tinha
`animation: pulse 1.6s infinite`, e `pulse` é
`@keyframes pulse { 50% { opacity: .35 } }`. Parada, a faixa tem 7:1.
**Metade do tempo ela ficava em 2,2:1.** É a informação mais urgente da
loja, e apagava justamente enquanto alguém a lia devagar.

A primeira auditoria não pegou porque mede um instante: ou pega o quadro
bom, ou pega o ruim e você não sabe por quê. A correção do teste não foi
medir mais vezes — foi ler a REGRA: ela percorre os `@keyframes` da
folha de estilo, pega o menor `opacity` que a animação do elemento
declara (e a dos ancestrais, que apagam o filho junto) e mede o PIOR
quadro. Vira um número conhecido, não um sorteio.

A faixa agora pulsa o ANEL, não a tinta: chama a mesma atenção sem tocar
no texto. A tira de janela do topo (`.win .urgent`) tinha o mesmo
defeito e perdeu a animação — `--danger` e negrito já bastam.

Junto veio o que faltava no site inteiro: **`prefers-reduced-motion`**.
O painel já respeitava (40-admin); a loja não respeitava nada. Quem
marcou "reduzir movimento" no sistema está dizendo que animação lhe
custa — enxaqueca, vertigem, distração.

Com a medição mais dura, a auditoria passou a acusar mais três coisas —
e duas delas a própria norma isenta, então o teste é que estava errado:

- `aria-hidden`: o "›" das migalhas é DECORATIVO, não texto;
- desabilitado: a 1.4.3 isenta componente inativo (o "−" do contador com
  quantidade 1);
- opacidade efetiva ~0: não é baixo contraste, é "não está na tela" —
  painel no meio da animação de entrada.

As três viraram isenções explícitas, com a razão escrita ao lado. O "−"
desabilitado ficou visualmente melhor mesmo sendo isento: 35% de
opacidade some no papel claro, e botão que some não lê como "desligado",
lê como "sumiu".

### O zero que não valia nada

Rodei a auditoria contra `https://atgangway.com` para provar que
produção estava limpa. Ela respondeu **"0 regras abaixo do AA"**, e eu
quase reportei isso como prova.

Não era. O navegador desta máquina não alcança a internet — o relay
fecha os túneis do Chromium no meio da troca (`ws_closed_mid_exchange`;
é o mesmo bloqueio que fez o carrinho girar e revelou aquele defeito).
As 19 rotas falharam ao abrir, e o `catch { continue }` do script pulou
todas em silêncio. O zero era vácuo, não aprovação.

**Um teste que passa quando não testou nada é pior que teste nenhum,
porque dá confiança.** O script agora acumula as rotas que não abriram,
lista cada uma com o motivo e sai com código 1 — reprova por não ter
testado, que é o veredito honesto.

Verificado: contra produção inacessível, `exit 1`. Contra um
`next start` local, `exit 0` com as 19 rotas medidas.

Não contornei o bloqueio desligando a verificação de TLS do navegador —
tentei o proxy do ambiente e ele não sustenta o tráfego do Chromium.
A auditoria roda contra o `next start` local, que serve **o mesmo
artefato** que a Vercel publica; o que se confere em produção é o CSS
compilado, por `curl`:

```
CSS=$(curl -s https://atgangway.com/faq | grep -o 'href="[^"]*\.css[^"]*"')
curl -s "https://atgangway.com${CSS#href=\"}" | grep -c '255,182,72'   # 0 = âmbar morto não voltou
```

### E o sinal errado que o zero silencioso escondia

Com o script reprovando por rota não coberta, apareceu o que o silêncio
guardava: `/orders` e `/captain` estouravam 20 s. **Não era a página.**
As duas redirecionam para `/login`, e a tela de login tem uma dúzia de
`<Link>` visíveis — o App Router busca a rota de cada um em rajada
(`?_rsc=`) e a janela de 500 ms sem rede que o `networkidle` espera
nunca fecha.

Trocado por `domcontentloaded` + `load`. Mais rápido, sem flakiness, e
mede o mesmo.

Medi o prefetch de passagem, porque parecia desperdício de banda de
navio: 19 requisições e 11 KB no desktop, 7 e 6 KB no celular, a partir
de UMA visita a `/faq`. Ficou como está — depois que essas rotas viraram
estáticas, cada prefetch é acerto de CDN, não invocação de função. É
exatamente para isso que o prefetch serve.

O teste foi validado duas vezes, reintroduzindo defeito de propósito:
o logotipo da gaveta (pega, `2.15:1 … "Gangway"`) e o selo "New"
(pega, `3.25:1`, `exit 1`, seis rotas). Estado final: `exit 0`, 19
rotas × 2 larguras + 3 painéis, 0 regras abaixo do AA; 254 testes.

## 2026-09-04 — a resposta do FAQ partida em três colunas

Relato do Gustavo, com print: as respostas do FAQ apareciam quebradas —
um pedaço da frase, o link numa coluna estreita no meio, o resto da
frase noutra coluna.

A causa é de manual, e vale guardar. O FAQ reaproveitava a casca do
acordeão do rodapé, e junto veio esta regra:

```css
.sunfoot-body a, .sunfoot-body span { min-height: 40px; display: flex; }
```

Ela é CERTA no rodapé, onde cada `<span>` é um rótulo de uma linha e
precisa de 40px de alvo de dedo. Mas o FAQ envolvia a RESPOSTA INTEIRA
num `<span>` — e `display: flex` é em linha por padrão, então cada
trecho de texto e cada `<a>` viravam um item de flex, ou seja, uma
coluna. A frase se partia em três.

Regra de componente que não diz de que componente é acaba assim: certa
no lugar em que nasceu, destruidora dois arquivos adiante.

Corrigido nas duas pontas, porque as duas estavam erradas:

- a regra do rodapé foi escopada em `.sunfoot` — não pode mais atingir
  quem só reaproveita a classe;
- o FAQ ganhou classe própria (`.faq-a`) com tipografia de LEITURA:
  14,5px, entrelinha 1,65 e `max-width: var(--read-w)`, porque linha de
  1200px num monitor largo faz o olho perder onde estava ao voltar. O
  acordeão (`.sunfoot-sec`) continua compartilhado — casca é casca.

Junto: o filete âmbar de `.pagettl` passava POR CIMA da perna do Q em
"FAQ". `padding-bottom` de 11px para 16px.

### A auditoria virou de INTERFACE, não só de contraste

Nenhum teste pegava isso, e a auditoria de contraste também não: as
cores estavam certas. O que estava errado era a CAIXA.

`scripts/auditar-interface.mjs` (`npm run audit:ui`) agora tem duas
famílias de achado. A nova acusa **texto corrido dentro de container
flex/grid**, por dois padrões que praticamente nunca são intenção:

- `texto → elemento → texto` — uma frase partida por um `<a>` ou `<b>`;
- um trecho de texto solto com 40+ caracteres — frase inteira virando
  item de flex.

O que ela NÃO acusa é ícone + rótulo curto (`<Icon/> Salvar`), que é o
motivo legítimo de haver texto solto num container flex.

Validada do mesmo jeito que as outras: reintroduzi o bug (as duas
metades — o `<span>` e a regra sem escopo), confirmei que ela reprova
nomeando a causa —

```
### /faq (desktop) — LAYOUT
  texto corrido em display:flex / row  .SPAN  — frase partida por elemento
```

— e só então restaurei. Estado final: `exit 0`, 0 achados, 254 testes.
