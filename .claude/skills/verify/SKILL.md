---
name: verify
description: Como subir o At Gangway e dirigir a loja para observar uma mudança rodando — build, login de teste, medição de layout e as armadilhas do sandbox.
---

# Verificar a loja rodando

Receita testada em 16/09/2026. A superfície é o navegador: a loja é um
Next.js 16 (App Router) e quase tudo que importa só aparece renderizado.

## Subir

```bash
npm run build && PORT=3000 npm run start   # ~45s de build
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

**Não use `npm run dev` para nada que toque sessão.** Ele sobe sem as
variáveis do Supabase e `/auth/confirm` devolve 500 — o login falha e
parece bug da aplicação. Só o build de produção tem o ambiente.

`npm run build` cria `AGENTS.md` e `CLAUDE.md` na raiz. Apague depois
(`rm -f AGENTS.md CLAUDE.md`) ou eles sujam o `git status`.

## Dirigir

Playwright está instalado, mas o Chromium mora fora do projeto e o
script precisa rodar COM O CWD no projeto para o import resolver:

```bash
cd /home/user/atgangway
node --input-type=module < /caminho/do/script.mjs        # heredoc não resolve o import
```

```js
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
```

**O navegador do sandbox não tem internet.** Não dá para dirigir
`https://atgangway.com` — o `goto` estoura o timeout. Duas saídas:

- conferir o artefato publicado por `curl` (HTML servido, CSS dos
  chunks em `/_next/static/immutable/chunks/*.css`);
- para páginas de cliente que falam com o Supabase pelo navegador,
  repassar as chamadas pelo Node, que TEM rede:

```js
await ctx.route("https://cuaocjxofaizefzcxlyc.supabase.co/**", async (route) => {
  const req = route.request();
  const h = { ...req.headers() }; delete h.host; delete h["content-length"];
  const r = await fetch(req.url(), { method: req.method(), headers: h,
    body: req.postDataBuffer() ?? undefined, redirect: "manual" });
  const buf = Buffer.from(await r.arrayBuffer());
  const out = {}; r.headers.forEach((v, k) => {
    if (!["content-encoding", "content-length", "transfer-encoding"].includes(k)) out[k] = v; });
  await route.fulfill({ status: r.status, headers: out, body: buf });
});
```

## Entrar como cliente

Não há link mágico; o login é por senha. Para uma sessão sem saber
senha nenhuma, emita um token de recuperação de uso único pelo MCP do
Supabase e abra `/auth/confirm`:

```sql
with u as (
  update auth.users
     set recovery_token = encode(extensions.digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha224'), 'hex'),
         recovery_sent_at = now()
   where email = 'ghcastellano+teste@gmail.com'
  returning id, email, recovery_token
)
insert into auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at)
select gen_random_uuid(), u.id, 'recovery_token', u.recovery_token, u.email, now(), now() from u
on conflict (user_id, token_type) do update
  set token_hash = excluded.token_hash, created_at = now(), updated_at = now()
returning token_hash;
```

```js
await page.goto(`${BASE}/auth/confirm?token_hash=${HASH}&type=recovery&next=/`);
```

**O token é de uso único**: emita um novo a cada rodada, senão a
segunda cai em `/login` e você mede a tela errada. Guarde o
`storageState()` para reusar a sessão entre scripts. No fim, apague as
sessões que abriu:

```sql
delete from auth.sessions s using auth.users u
 where u.id = s.user_id and u.email = 'ghcastellano+teste@gmail.com'
   and s.created_at > now() - interval '2 hours';
```

`ghcastellano+teste@gmail.com` é conta de teste (0 pedidos), criada
para isto. `help@` e `ghcastellano@` são contas reais de operação.

## Os três estados da home

`loadCrew` (app/page.tsx) decide o que a home mostra, e cada estado é
um layout diferente:

| Estado | Como chegar | O que aparece |
|---|---|---|
| `null` | deslogado | cartão "como funciona" (`.herosteps`), classe `lado` |
| `vessel` | logado com `profiles.ship_id` | painel do navio (`.vpanel`), classe `lado` |
| `invite` | logado SEM `ship_id` | nenhum cartão, SEM classe `lado` |

O `invite` é o único caminho em que não há cartão. Para alcançá-lo,
zere o `ship_id` da conta de teste e **restaure logo depois**, com o
valor anotado antes:

```sql
select ship_id from profiles where email = 'ghcastellano+teste@gmail.com';  -- anote
update profiles set ship_id = null where email = '...';                     -- dirija
update profiles set ship_id = '<o valor anotado>' where email = '...';      -- restaure
```

## Medir layout em vez de olhar

Captura de tela prova o que você viu; medida prova o que o usuário
tem. Para regressões de grade (cartão em cima do herói, faixa cortada,
rolagem lateral) meça no `page.evaluate`:

```js
const cruza = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
```

Larguras que importam: **360/390** (celular), **768/820** (iPad em pé),
**1024/1180** (iPad deitado), **1366/1920** (desktop). O corte de
layout é em 768px e de novo em 1024px.

Cuidado ao ler larguras entre 431 e 767px: `--shell-w: 430px` faz a
loja virar uma coluna de 430px centrada. Não é bug da mudança que você
está verificando — é o desenho da casca.

## Armadilha que já custou trabalho

Para desfazer uma edição temporária, **`cp` de backup, nunca
`git checkout <arquivo>`** — o checkout restaura o arquivo do último
commit e leva junto todo o trabalho não commitado dele.
