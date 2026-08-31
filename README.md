# Vessel Supplier — app MVP

**🟢 No ar: <https://vesselsupplier.vercel.app>**

Loja de conveniência com **entrega na prancha de embarque** para tripulações em escala
no **Porto de Santos**. Este repositório agora contém a **aplicação completa do MVP**
(mobile-first), evoluída a partir dos protótipos de `prototype/`.

A tese, pesquisa e features estão em [`docs/TESE.md`](docs/TESE.md).

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript — sem framework de CSS: o design
  system "Hull & Chart" do protótipo foi portado direto para `app/globals.css`.
- **Supabase** — Postgres + Auth (Google OAuth, email com confirmação, esqueci a senha)
  com RLS em todas as tabelas. Migrações versionadas em `supabase/migrations/`.
- Pensado para deploy na **Vercel**.

## Por que o protótipo abria com faixa branca no celular?

O protótipo era uma página de demonstração dentro do **viewer de Artifacts do claude.ai**,
que embute a página num frame que não ocupa a última faixa da tela no Safari (barras
dinâmicas do iOS). Como o protótipo se travava em `height: 100svh` num "frame de celular",
tudo que sobrasse fora do frame aparecia com o fundo claro do site hospedeiro.

No app real isso não existe: a página é dona do viewport. Mesmo assim, o layout aplica as
defesas certas — fundo escuro em `html/body` (nunca só num container), `min-height: 100dvh`,
`viewport-fit=cover` + `theme-color` escuro e barras fixas com `env(safe-area-inset-bottom)`.

## Rotas

| Rota | Quem | O que |
|---|---|---|
| `/` | público | Seleção de navio (line-up com ETA, berço e janela de pedido) |
| `/shop` | público | Catálogo por categoria, carrinho persistente no aparelho |
| `/cart` | público | Resumo com depósito de 30% e saldo na prancha |
| `/checkout` | logado | Confirmação do pedido (preços validados no servidor) |
| `/orders` · `/orders/[code]` | logado | Meus pedidos + tracking em 4 etapas |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` | público | Acesso do cliente: Google **ou** email+senha com confirmação e recuperação |
| `/account` | logado | Conta, pedidos, sair — e atalho pro painel staff |
| `/admin` | staff | Board de pedidos com KPIs e avanço de status |
| `/admin/ships` · `/admin/products` | staff | CRUD do line-up e do catálogo |
| `/admin/shopping-list` | staff | Lista de compras consolidada (pedidos com depósito pago) |

Fluxo de status do pedido:
`awaiting_deposit → deposit_paid → preparing → at_gangway → delivered`
(+ `credited` quando o navio desvia — o depósito vira crédito — e `cancelled`).

**Acesso admin:** quem consta em `admin_emails` (seed já inclui `ghcastellano@gmail.com`)
vira `admin` automaticamente ao criar a conta. Para promover alguém depois:
`update public.profiles set role = 'admin' where email = 'pessoa@email.com';`

## Rodando local

```bash
npm install
cp .env.example .env.local   # preencha com URL + anon key do Supabase
npm run dev
```

Sem as variáveis o app builda e abre normalmente, mostrando um aviso de
"backend not configured" — útil para validar o front isolado.

## Infra provisionada (estado atual)

- **Supabase:** projeto `mariners-supply` (`cuaocjxofaizefzcxlyc`, região `sa-east-1`),
  com as 3 migrações de `supabase/migrations/` aplicadas (schema+RLS, seed, hardening).
  As chaves públicas estão commitadas em `.env.production` (a publishable key roda no
  navegador por design; a segurança vem da RLS).
- **Vercel:** projeto `vesselsupplier` linkado a este repositório — **push no `master`
  faz deploy de produção automático**; branches geram preview.
- Dashboard do banco: <https://supabase.com/dashboard/project/cuaocjxofaizefzcxlyc>

### Auth — configuração no Dashboard (passo manual)

Em [Authentication → URL Configuration](https://supabase.com/dashboard/project/cuaocjxofaizefzcxlyc/auth/url-configuration):

- **Site URL:** `https://vesselsupplier.vercel.app`
- **Redirect URLs:**
  - `https://vesselsupplier.vercel.app/**`
  - `https://*-gustavos-projects-287c5dd3.vercel.app/**` (previews)
  - `http://localhost:3000/**`

Sem isso, os links dos emails de confirmação/recuperação caem no Site URL padrão
(`localhost:3000`) em vez do domínio de produção.

Em **Authentication → Providers**:

- **Email:** já vem com confirmação obrigatória ligada. `/auth/confirm` aceita os dois
  formatos de link (`?code=` do template padrão e `?token_hash=` de template
  customizado). O SMTP padrão do Supabase é limitado (±2 emails/h) — para produção
  configure um SMTP próprio em *Authentication → Emails → SMTP*. Com SMTP ativo, os
  templates com a marca (links por `token_hash`, que funcionam mesmo abrindo o email
  em outro navegador) estão prontos em `supabase/templates/email-templates.json` —
  é aplicar via Management API (`PATCH /v1/projects/{ref}/config/auth`) ou colar no
  dashboard.
- **Google:** crie um OAuth Client (Web) no
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) com
  redirect URI `https://cuaocjxofaizefzcxlyc.supabase.co/auth/v1/callback`, e cole
  Client ID/Secret no [provider Google](https://supabase.com/dashboard/project/cuaocjxofaizefzcxlyc/auth/providers).
  Sem isso o botão "Continue with Google" avisa que o método ainda não está habilitado
  (email continua funcionando).

## O que fica para depois do MVP (roadmap curto)

- **Pagamento online real** do depósito (Stripe international / Pix) — hoje o pedido
  nasce `awaiting_deposit` e o staff confirma o depósito no board (link de pagamento
  manual), que é como a fase 0 opera na prática.
- Programa **Captain** (indicação por QR, crédito 5–7%) — telas já desenhadas no protótipo.
- Pedido nativo via WhatsApp, tracking por AIS, i18n (EN primeiro já é o padrão do app).

## Protótipos

Os HTMLs originais (app, ops, brand system, estratégia, catálogo A4 e planilha fase 0)
foram movidos para [`prototype/`](prototype/) e continuam abrindo direto no navegador.
