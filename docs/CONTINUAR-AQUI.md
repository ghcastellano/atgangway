# Continuar daqui — sessão de 16/09/2026

Bilhete de passagem entre uma sessão do Claude Code na web e a próxima
(VSCode, máquina do Gustavo). Quem abrir este arquivo já sabe o que foi
feito, o que ficou de pé e o que fazer sem precisar perguntar nada.

Tudo que está descrito abaixo como "feito" está commitado e no ar em
`main` — 13 commits, de `26d2250` a `2f9b12f`.

---

## Atualização — segunda sessão de 16/09/2026 (VSCode, máquina do Gustavo)

Tudo em `main`, publicado e testado em https://atgangway.com, de
`87b7d65` a `89431b2`.

- **P1 fechada.** Os templates de confirmar/redefinir já estavam no
  projeto. Depois, os **treze** e-mails de conta do Supabase passaram a
  sair da mesma casca (`c7cc7ab`): trocar e-mail, link de acesso,
  convite, código e os sete avisos de segurança eram o HTML cru do
  Supabase. Os avisos continuam DESLIGADOS no projeto — só o texto está
  pronto.
- **Nomes antigos fora** (`4970991`): todo e-mail abria com
  "⚓ VESSEL SUPPLIER"; agora "⚓ AT GANGWAY". Testes reprovam
  "mariner" e "vessel supplier" em qualquer e-mail.
- **P3 inteira feita:** vitrine sem `:has()` (`87b7d65`); erros de auth
  por código em `lib/authmsg.ts`, que também fechou `/login?error=<texto
  livre>` (`bab3080`); `bloqueioDoCheckout()` (`c300bea`); cartão da home
  só com `span 4`, medido em 7 larguras (`e696a46`); `.sup-escura`
  (`c0df654`).
- **Contraste do painel** (`75daa5f`): rótulos das Sobras e da tabela
  sob o mouse estavam a 3,9:1; agora 6,05:1, medido na folha publicada.
- **P4 #13 fechada:** `scripts/auditar-interface.mjs` roda fora do
  ambiente web (`89431b2`); contra produção, logado, 19 rotas em celular
  e desktop: 0 achados.

Pendente de decisão do Gustavo:

- `.env.production`, linha 1, ainda chama o projeto de "mariners-supply"
  (ele já se chama `atgangway`); a configuração não deixa o agente ler
  nem editar esse arquivo.
- `prototype/`, `docs/TESE.md` e `docs/HISTORICO.md` ainda citam a marca
  antiga e o **Mariner's Bar** (o bar parceiro, que não é nome antigo da
  loja). O banco tem um ponto de retirada inativo "Mariner's Bar —
  pickup". Não mexi sem saber o que fica.
- Ligar ou não os avisos de segurança por e-mail (senha trocada etc.).
- As chaves `ms.cart.v2`, `ms.ref.v1` e `ms.wish.pending` do
  localStorage vêm do nome antigo. Trocar sem migração apaga o carrinho
  de quem já tem um.
- Porta 3000 desta máquina está ocupada por um processo Python; para
  subir a loja local use outra porta.

---

## O que foi feito nesta sessão

### 1. iPad: o cartão pousava em cima do herói (`26d2250`, `c1e4c85`, `0ff33ac`)

Três commits no mesmo sintoma, porque as duas primeiras tentativas
trataram sintoma. As causas eram duas escritas da mesma frase:
`:has()`, que o Safari < 15.4 ignora, e a faixa 768–1023px, onde o
herói ainda tinha 12 colunas enquanto o cartão já ia para a coluna 9.

A correção de raiz: a classe `lado` passou a **sair do próprio cartão**
em `app/page.tsx` — um valor só decide o que é renderizado E a classe.
No CSS, aparência e posição ficaram separadas, de modo que uma
discordância futura degrada empilhando, nunca sobrepondo.

`tests/heroi.test.mjs` guarda as duas invariantes. Ele foi afrouxado
depois (ver §4) para não quebrar com um rename ou um `prettier`.

### 2. Fluxos completos percorridos até o fim, no navegador

Pergunta original: *"quando se atualiza no admin, atualiza para o
cliente? A tela de orders parece atrasada em um step."*

**Não há atraso.** Medido nas quatro transições
(`awaiting_deposit → deposit_paid → preparing → at_gangway`): a pílula
do painel, a linha da lista do cliente, o selo e o passo aceso da
trilha concordaram, tanto navegando por clique quanto após recarga
forçada. O "um passo atrás" que o Gustavo lembrava bate com um defeito
que existiu e já estava corrigido (um mapa de passos paralelo na página
do cliente, documentado em `lib/types.ts`).

Estados terminais percorridos e conferidos no banco:

| Pedido | Ação | Resultado |
|---|---|---|
| AG-1214 | compra real com Stripe em produção | `delivered`; e-mail `deposit_paid` registrado |
| AG-1215 | Entregue **com foto** | `delivered`, `delivered_at`, foto no storage |
| AG-9001 | Cancelar | `cancelled` |
| AG-9002 | Creditar (navio desviou) | `credited` + crédito de USD 36,00 pelo gatilho `order_credit_on_status_trg`, **uma linha só** |

Contas de teste criadas e provisionadas: `ghcastellano+crew1@gmail.com`
(Rajesh Kumar, chief engineer, BOW CHEETAH) e
`ghcastellano+crew2@gmail.com` (Maria Santos, cook, MSC SOFIA PAZ).
`ghcastellano69@gmail.com` recebeu acesso admin, com autorização
explícita.

**Dúvida antiga fechada:** os e-mails de `at_gangway` e `delivered` não
ficaram registrados nos testes de hoje porque as transições rodaram no
servidor LOCAL, que não tem SMTP. Em produção os quatro tipos já saíram
(`at_gangway` ×3, `delivered` ×2, `credited` ×2, `deposit_paid` ×4).

### 3. Link de e-mail gasto mandava pedir outro (`8b25ebb`)

Quem confirmava a conta e clicava no link uma segunda vez caía em
*"That link is invalid or expired — request a new one"*. Mentira por
omissão: o link já tinha funcionado. O Supabase responde a mesma coisa
para link gasto e link expirado, e a tela repassava a indistinção.
Agora confirmação de conta e redefinição de senha têm respostas
diferentes. Verificado em produção com `curl` nos dois ramos.

### 4. `/simplify` (`9a8fd10`)

Quatro revisores em paralelo; quatro achados com consenso, todos dívida
recém-criada, nenhum bug:

- o mínimo do porto virou `faltaParaMinimo()` em `lib/money.ts` — antes
  eram três redações da mesma frase (carrinho, checkout e a tradução do
  RPC);
- o espaçamento do "Signed in as" saiu de um `style` inline que
  silenciosamente matava a regra de desktop;
- `/auth/confirm` teve as três montagens de URL reduzidas a uma;
- `tests/heroi.test.mjs` parou de casar o texto exato de uma linha do
  `page.tsx` e de exigir que os dois cartões fossem regras separadas.

Pulados de propósito, e continuam valendo como próximos passos (§6).

### 5. `/security-review` (`bc57b97`)

Um achado MÉDIO, e era sobre a própria allowlist que eu tinha acabado
de abrir a pedido: `Bash(curl -s:*)` é prefixo e liberava qualquer
requisição de saída sem aprovação, o que torna inerte o
`Read(./.env.production)` da lista de `deny`. Como `lib/lineup.ts`
raspa HTML de terceiros que chega ao modelo como resultado de
ferramenta, isso não é hipotético. Fechado: `curl -s` agora só alcança
`localhost:3000` e `atgangway.com`; `node -e` e `node --eval` entraram
no `deny`.

Continuam abertos por decisão: `Bash(git push:*)` (é a instrução
permanente do projeto) e `Bash(node --input-type=module:*)` (é como os
roteiros de Playwright rodam).

### 6. E-mails (`6fe0de0`, `f92e2b4`, `2f9b12f`)

Dois defeitos diferentes, achados pelo Gustavo na própria caixa.

**a) Frase preta sobre fundo quase preto.** A casca dos e-mails não
tinha `<head>` e nunca declarou `color-scheme`. Sem isso o Gmail no
Android assume que precisa adaptar a mensagem ao tema do aparelho e
reescreve cores por heurística, elemento a elemento — num e-mail que já
nasce escuro, o conserto é o estrago. O trecho que caiu era o que vinha
depois de um `<br>`, herdando a cor do `<p>`. Agora cada frase carrega
a própria cor, e um teste geral reprova qualquer `<br>` seguido de
texto sem elemento com cor própria.

**b) Os e-mails de conta assinavam a marca ANTIGA.** Confirmar cadastro
e redefinir senha não saem do nosso servidor: quem manda é o Auth do
Supabase, a partir de um HTML guardado na configuração do projeto.
Deploy não alcança, build não vê, nenhum teste tocava — e o arquivo
versionado dizia uma coisa enquanto o projeto mandava outra, há meses,
em todo cadastro novo.

Três peças novas:

- `scripts/gerar-templates-email.mjs` monta os dois templates com a
  MESMA casca dos transacionais (`shell`, agora exportada de
  `lib/emails.ts`) e grava `supabase/templates/email-templates.json`;
- `scripts/aplicar-templates-email.mjs` manda para o projeto pela
  Management API — seco por padrão, `--aplicar` para valer, e relê no
  fim para provar que entrou;
- `tests/templates-conta.test.mjs` reprova se o JSON commitado sair de
  sincronia com o gerador, se a marca antiga voltar, ou se algum dos
  dois e-mails perder o link que ele existe para entregar.

---

## O que está pendente, em ordem de urgência

### P1 — Aplicar os templates no projeto do Supabase  ✅ FEITO (ver atualização no topo)

O código está pronto e commitado; falta rodar contra o projeto. Exige
um token pessoal, que o ambiente da web não tem e não deve ter.

```bash
node scripts/aplicar-templates-email.mjs            # seco
node scripts/aplicar-templates-email.mjs --aplicar  # manda
```

`SUPABASE_ACCESS_TOKEN` tem de estar no ambiente. Se não estiver, o
script diz isso e sai — **peça ao Gustavo e pare; não invente outro
caminho, não escreva o token em arquivo nenhum, não o imprima.**

Depois de aplicar: dispare um cadastro de teste (por exemplo
`ghcastellano+conf1@gmail.com`) e confirme que o e-mail que chega diz
"At Gangway" no assunto, no corpo e no remetente.

### P2 — Segredos expostos, a trocar (ação do Gustavo)

Três segredos apareceram em capturas de tela nesta sessão. **Nunca
repita os valores; eles não estão escritos aqui de propósito.**

1. **Senha do SMTP** (`help@atgangway.com`, Hostinger). Trocar na
   Hostinger e atualizar em DOIS lugares: Supabase → Authentication →
   Emails → SMTP Settings, e a variável `SMTP_PASS` na Vercel.
2. **Senha da conta `ghcastellano69@gmail.com`**.
3. **Segredo do cron** (`app_secrets.cron_secret`), pendente de antes.

Também: na tela de Access Tokens do Supabase havia quatro tokens
`LEGACY` **nunca usados e sem expiração**. Apagar.

### P3 — Achados de revisão pulados de propósito  ✅ FEITO (ver atualização no topo)

Cada um é um pedaço de trabalho fechado; nenhum é urgente.

- **Tornar a sobreposição da home impossível, não só policiada.** Hoje
  o cartão pousa por posição absoluta (`grid-column: 9 / -1`) e a
  garantia é convenção guardada por teste. Auto-placement
  (`grid-column: span 4`, sem linha explícita) faria uma classe errada
  degradar para cartão estreito na linha 2 em vez de sobreposição.
  Exige medir nas quatro larguras (390 / 768 / 1024 / 1440) antes de
  commitar — foi a quarta mexida seguida nesse bloco que eu não quis
  fazer às cegas.
- **`app/styles/90-desktop.css:768`** — `.pg-list:has(.facets) …
  { display: none }` é EXATAMENTE o perigo que derrubou o iPad, agora
  na vitrine: Safari < 15.4 ignora `:has()` e vai ver a navegação de
  categorias duplicada. O teste novo só vigia a home.
- **Quarta cópia do bloco de tokens de superfície escura** (cabeçalho,
  painel, vitrine, abas da conta). Pede uma classe `.sup-escura`
  compartilhada e uma entrada em `tests/cores.test.mjs` para a família
  escura.
- **Frases de erro de auth em query string.** `/auth/confirm` escreve
  as mensagens inline, `app/login/page.tsx` casa por regex a mensagem
  do próprio Supabase: quatro autores de texto de auth, nenhum testado.
  Pede `?error=<código>` e um `lib/authmsg.ts` com teste, como
  `lib/pedido.ts` já faz para as recusas de compra.
- **`app/checkout/CheckoutClient.tsx:186`** — as pré-condições
  acumulam como booleanos paralelos (`canPay = !blocked && !belowMin &&
  …`) e a ORDEM do ternário decide qual "não" vence. Pede um valor
  único `bloqueio: null | {label, hint}`, como a home acabou de fazer.

### P4 — Tarefas antigas ainda abertas

- **#6** "Fase 6 — relatório final": `docs/CUSTOS-E-PLANOS.md` está
  escrito (US$ 45/mês fixos, banco em 17,5 MB de 8 GB, primeiro teto é
  o compute Micro), mas a linha da tarefa segue aberta.
- ✅ **#13** "Área logada não auditada visualmente" — fechada (ver topo). Histórico: parcialmente feita
  (`636a71a` achou a barra inferior abaixo do AA e o checkout que
  ignorava o mínimo). O auditor agora reprova quando roda sem sessão
  (§ abaixo), então vale rodar com `AUDIT_STATE` e fechar.
- Conta de admin do Junaid (falta o e-mail dele).
- 107 produtos sem foto real.
- Total do carrinho corrente e sugestões na busca.

---

## Como rodar as coisas aqui

`.claude/skills/verify/SKILL.md` é a receita testada — **leia antes de
tentar subir a loja**. O essencial:

```bash
npm run build && PORT=3000 npm run start   # ~45s; NUNCA `npm run dev` para
                                           # nada que toque sessão
npm test                                   # 276 testes, 222 passam, 0 falham
node scripts/auditar-interface.mjs http://localhost:3000
```

O auditor de interface agora **reprova** quando uma rota logada
redireciona para `/login` — antes ele media a tela de login quatro
vezes e imprimia total verde. Para auditar a área logada, passe
`AUDIT_STATE=<storageState.json>`.

Armadilhas que já custaram tempo e estão na skill: usar `localhost` e
nunca `127.0.0.1` (o cookie fica no host errado); `cp` de backup e
**nunca** `git checkout <arquivo>` para desfazer edição temporária; e
páginas de cliente que falam com o Supabase pelo navegador precisam do
repasse das chamadas — sem ele, `getUser()` devolve null e a página se
expulsa sozinha, o que parece bug e não é.

## Regras permanentes do projeto

- Commits e pushes vão para `main` de `github.com/ghcastellano/atgangway`.
- Todo caminho de arquivo citado em resposta vai como URL completa
  `https://github.com/ghcastellano/atgangway/blob/main/...`.
- **Nunca** escrever segredo em resposta, em commit ou em arquivo.
- Migração aplicada no Supabase é documentada em `supabase/migrations/`.
- Perguntar antes de implementar quando houver bifurcação real.
