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
