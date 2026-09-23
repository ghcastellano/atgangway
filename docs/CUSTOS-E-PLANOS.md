# Custos e planos — At Gangway

> **Revisado em 23/09/2026.** O levantamento original é de 12/09 e continua
> abaixo. O que mudou desde então está nesta seção — inclusive duas coisas que
> o texto antigo dizia errado.

## O que mudou em 23/09/2026

**O add-on de domínio próprio do Supabase existia e ninguém tinha contado.**
US$ 10/mês desde 26/08, servindo `auth.atgangway.com`. Não era dinheiro parado:
o Supabase manda esse endereço ao Google em **todo** login com OAuth, mesmo
quando o app chama pelo endereço padrão. Medido, não suposto.

**O custo fixo real era US$ 55/mês, não US$ 45.** Vercel Pro (20) + Supabase
Pro (25) + domínio próprio (10).

**O repasse pelo próprio domínio substitui o add-on, de graça.** Os rewrites em
`next.config.ts` fazem o navegador chamar `atgangway.com/auth/v1/…`,
`/rest/v1/…` e `/storage/v1/…`. Ligado por `NEXT_PUBLIC_SUPABASE_PROXY=1`.
O servidor continua indo direto ao Supabase — de propósito, ver o comentário no
`next.config.ts`.

O que o repasse **não** resolve: o endereço de retorno do login com Google. Ele
vem da configuração interna do Auth, não do host que chamou — o `redirect_uri`
é idêntico com e sem repasse. Os dois endereços (`auth.atgangway.com` e
`cuaocjxofaizefzcxlyc.supabase.co`) já estão registrados no Google Cloud,
verificado com controle negativo, então desligar o add-on não derruba o login.

**O token da Vercel enxerga o time.** O texto antigo, mais abaixo, diz que não —
está errado. O problema era passar `teamId` nas chamadas; sem ele, o
faturamento abre normalmente. Uso real medido: **US$ 0,09/dia**, contra um
crédito de US$ 20/mês.

### Para onde o Supabase pode ir

| Item | Uso hoje | Cabe no Free? |
| --- | --- | --- |
| Banco | 18 MB | 500 MB — 3,6 % |
| Storage | 16 MB, 47 arquivos | 1 GB — 1,6 % |
| Usuários ativos/mês | 9 | 50.000 — 0,02 % |

O Free pausa após 7 dias **sem escrita no banco**, e os três crons escrevem
(`vessel-lineup-hourly` roda 168 vezes por semana, 0 falhas). O que se perde de
verdade é o backup diário — por isso existe `scripts/backup-supabase.mjs`.

### O que ficou decidido

- Repasse pelo domínio próprio: **ligado** (economiza US$ 10/mês do add-on).
- Vercel Pro: **mantida**. O Hobby proíbe uso comercial e a loja tem Stripe
  ativo, com compra real processada. Não é sobre caber no limite.
- Supabase Free: **avaliado e viável**, condicionado ao backup automático estar
  rodando antes.

---

Medido em 12/09/2026, no projeto de produção (Supabase `cuaocjxofaizefzcxlyc`,
Vercel `atgangway`). Preços em dólar, sem impostos, conforme a documentação
oficial dos dois na mesma data.

## Resumo em uma linha

**A infraestrutura custa ~US$ 45/mês fixos e vai continuar custando isso até a
loja ter milhares de pedidos por mês.** Não há decisão de plano a tomar agora;
há dois avisos para ligar (abaixo) e um único gatilho de upgrade para vigiar.

## O que está contratado

| Serviço | Plano | Custo fixo | Por quê este plano |
| --- | --- | --- | --- |
| Vercel | Pro (1 assento) | US$ 20/mês | O Hobby **proíbe uso comercial** — uma loja não pode ficar nele. |
| Supabase | Pro (org `ghcastellano's Org`) | US$ 25/mês | O Free **pausa o projeto após 7 dias sem uso** e não tem backup diário. Loja parada não é loja. |
| Domínio `atgangway.com` | registro anual | — (fora deste levantamento) | |
| E-mail `help@` (Hostinger) | mensal | — (fora deste levantamento) | |
| Stripe | por transação | ~3,99 % + R$ 0,39 (cartão internacional) | Só cobra quando vende. |

Total fixo de infraestrutura: **US$ 45/mês** (≈ R$ 250 ao câmbio de hoje).

## O que está sendo usado — e quanto cabe no plano

### Supabase (Pro: US$ 25 + US$ 10 de crédito de compute que cobre o Micro)

| Item | Uso hoje | Incluído no Pro | Ocupação |
| --- | --- | --- | --- |
| Banco (tamanho) | **17,5 MB** | 8 GB | 0,2 % |
| Storage (fotos de produto + comprovantes) | **14,6 MB**, 44 arquivos | 100 GB | 0,01 % |
| Usuários ativos por mês (MAU) | **4** | 100.000 | 0 % |
| Egress (dados saindo) | não medível daqui; as fotos saem pelo cache da Vercel, não pelo Supabase | 250 GB | ≪ 1 % |
| Compute | Micro (2 vCPU compartilhadas, 1 GB) | US$ 10 de crédito = Micro grátis | — |
| Requisições à API (edge) | **~3.000/dia** (≈ 90 mil/mês) | ilimitado no Pro | — |
| pg_cron | 3 jobs: line-up de hora em hora (168 execuções/semana, 0 falhas), ops diário, PTAX em dias úteis | incluído | — |

As maiores tabelas são `ships` (792 kB, 400 escalas), `products` (768 kB) e
`admin_notifications` (440 kB — 213 avisos de atraso do sino antigo; já
silenciados). Um pedido com itens ocupa ~10 kB: **os 8 GB incluídos dão para
~800 mil pedidos**. O banco não é o limite.

### Vercel (Pro: US$ 20/mês, com US$ 20 de crédito de uso incluídos)

| Item | Uso hoje | Incluído no Pro | Observação |
| --- | --- | --- | --- |
| Fast Data Transfer (tráfego) | não legível pelo token desta sessão (escopo errado — veja "Como conferir") | 1 TB/mês | Uma tela da loja pesa ~300 kB; 1 TB = **~3 milhões de páginas/mês**. |
| Edge Requests | idem | 10 milhões/mês | |
| Invocações de função | cron: ~750/mês; páginas dinâmicas (carrinho, checkout, conta, admin) | consomem o crédito de US$ 20 | 19 rotas + 130 páginas de produto são **estáticas** (cache HIT na borda): não invocam função. |
| Otimização de imagem | ~44 fotos × alguns tamanhos | consome o crédito | Depois da primeira geração, cada tamanho fica em cache. |
| Builds | 70 deploys desde 20/08 (~2–3 min cada) | máquinas Elastic incluídas | Cada push em `main` gera um deploy. |
| Região | `gru1` (São Paulo) | — | Mesma região do Supabase (`sa-east-1`): latência de ~5 ms entre eles. |

Com o tráfego atual, o uso fica muito abaixo do crédito de US$ 20; a fatura é
os US$ 20 do assento e nada mais.

## Quando cada plano deixa de bastar

Em ordem do que estoura primeiro:

1. **Compute do Supabase (Micro)** — é o único recurso que não escala com o
   plano, só com dinheiro. Sinal: CPU acima de 70 % por horas seguidas no
   painel *Reports* do projeto. Solução: Small (US$ 15/mês, o crédito de
   US$ 10 abate) ou Medium (US$ 60). Com a casca estática e o cache da borda,
   o banco só é tocado em carrinho, checkout, conta e painel; **o Micro
   aguenta centenas de pedidos por dia** antes disso.
2. **Crédito de US$ 20 da Vercel** — invocações de função e otimização de
   imagem. A Vercel avisa por e-mail aos 75 % do crédito; depois cobra sob
   demanda. Na prática só acontece com tráfego de dezenas de milhares de
   visitas/dia.
3. **1 TB de tráfego na Vercel** — ~3 milhões de páginas/mês. Longe.
4. **250 GB de egress do Supabase** — as fotos saem do cache da Vercel; o
   Supabase só serve a primeira vez. Longe.
5. **8 GB de banco** — ~800 mil pedidos. Longe.

Nenhum desses é problema deste ano. O custo vai subir antes por **outra
razão**: um segundo assento de deploy na Vercel (US$ 20/mês) se o Junaid ou
outra pessoa precisar publicar — e não precisa: o painel `/admin` é acesso à
loja, não à Vercel. Assento de Viewer é grátis.

## Dois avisos para ligar hoje (5 minutos)

1. **Vercel → Settings → Spend Management**: o alerta padrão é US$ 200 por
   ciclo. Baixe para **US$ 50** e ligue a ação "pausar projeto" só se você
   preferir sair do ar a pagar — para uma loja, prefira só o alerta.
2. **Supabase → Organization → Billing → Spend Cap**: confira que está
   **ligado**. Com ele, uso além da cota gera aviso e período de graça, não
   fatura surpresa. (Compute e domínio customizado ficam fora do cap.)

## O que NÃO vale a pena contratar agora

- **Add-ons do Supabase**: PITR (US$ 100/mês) — o backup diário do Pro basta
  enquanto um dia de pedidos couber em uma conversa de WhatsApp. Custom
  domain da API, IPv4 dedicado, read replica: nenhum tem uso aqui.
- **Add-ons da Vercel**: Web Analytics Plus (US$ 10), Speed Insights Plus,
  Observability Plus — os relatórios do painel e o `audit:ui` já cobrem o
  que interessa.
- **Segundo projeto Supabase para staging**: custa mais US$ 10/mês de compute
  e o fluxo atual (migrações versionadas + pgTAP em transação com rollback)
  já protege a produção.

## Como conferir você mesmo

- Vercel: `vercel.com/<time>/~/usage` — o token desta sessão está no escopo
  `gustavo-s` e não enxerga o time `team_WFhR…`, por isso o tráfego real não
  aparece acima. A tela de Usage mostra transferência, requisições e crédito
  consumido no ciclo.
- Supabase: `supabase.com/dashboard/org/_/usage` — egress, MAU, banco,
  storage e horas de compute; `Reports` no projeto para CPU e memória.

## Histórico de decisões de custo (para não rediscutir)

- **Região `gru1` + `sa-east-1`**: escolhida na Fase 1 por latência; sem
  diferença de preço.
- **Casca estática + `/api/sessao`** (setembro/2026): tirou o cookie do layout
  raiz; 149 rotas viraram estáticas. Foi a decisão que mais baixou custo
  futuro — cada página servida pela borda é uma invocação de função que não
  acontece.
- **Sync do line-up em lote** (`sync_ship_etas`): de ~165 chamadas por hora
  para 1. Foi o que segurou o Micro.
- **`metric()` da Vercel com tags de cardinalidade baixa**: observabilidade
  sem virar fatura.
