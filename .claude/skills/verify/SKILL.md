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

### Dirigir o site PUBLICADO

Dá sim — o navegador sai pelo proxy do ambiente, desde que ele confie
na CA. Duas peças (a segunda **não** vem pronta, apesar do que o
`/root/.ccr/README.md` afirma: o NSS nasce vazio):

```bash
apt-get install -y libnss3-tools     # o certutil não vem instalado
for f in /usr/local/share/ca-certificates/*.crt; do
  certutil -d sql:/root/.pki/nssdb -A -t "C,," -n "$(basename "$f" .crt)" -i "$f"
done
```

```js
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  proxy: { server: "http://127.0.0.1:37997" },   // = $HTTPS_PROXY
});
```

Sem isso o erro é `net::ERR_CERT_AUTHORITY_INVALID`. **Nunca** resolva
com `ignoreHTTPSErrors` nem `--ignore-certificate-errors`.

Ressalva medida: sob carga (uma página com muitos chunks) o proxy
devolve **502 intermitente** em `/_next/static/...`. O sintoma é a
página renderizar **sem CSS e sem JavaScript** — e aí nenhum botão
responde, o que parece defeito da aplicação e não é. Confira por
`curl` (os mesmos arquivos dão 200) e, para testar **interação**,
prefira o servidor local: só o Supabase precisa de rede.

Para páginas de cliente que falam com o Supabase pelo navegador,
repasse as chamadas pelo Node:

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
const BASE = "http://localhost:3000";   // NÃO use 127.0.0.1 — veja abaixo
await page.goto(`${BASE}/auth/confirm?token_hash=${HASH}&type=recovery&next=/`);
```

**Use `localhost`, nunca `127.0.0.1`.** O app redireciona para
`localhost` depois do `/auth/confirm`; começando em `127.0.0.1` o
cookie de sessão fica no host errado e a navegação cai em
`/admin/login` — com o Supabase registrando o login com sucesso, o que
manda você caçar um bug de permissão que não existe. Custou meia hora.

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
