# Fotos reais do catálogo

Resposta curta à pergunta "existe um dataset oficial com os produtos que
vamos vender?": **existe para uma parte, e a chave é o código de barras.**
Não existe nenhum acervo que tenha foto de um kit que a gente monta.

São três casos, e cada um tem uma via diferente.

---

## 1. Produto de marca, embalado — resolvido, é o que já está no site

Café Pilão, Guaraná, Nescau, Cheetos, creme dental Colgate. Esses têm
código de barras, e o código de barras é o que faz a foto ser **daquele
item**, e não de um parecido.

Os acervos abertos do projeto Open Facts cobrem isso:

| Acervo | O que tem | Endereço |
|---|---|---|
| Open **Food** Facts | comida e bebida | `world.openfoodfacts.org` |
| Open **Beauty** Facts | higiene e cosmético | `world.openbeautyfacts.org` |
| Open **Products** Facts | o resto | `world.openproductsfacts.org` |

As fotos são **CC BY-SA 3.0**: uso comercial liberado, com duas
obrigações — creditar e manter a mesma licença em qualquer versão
derivada. O site já cumpre as duas: cada foto importada vira uma linha em
`/attributions`, gravada automaticamente (`lib/fotolicenca.ts`).

Os dados (nome, marca, gramatura) são ODbL. Também exigem crédito.

### Busca por nome não serve

Está testado e falha: "amendoim dori" devolveu pasta de amendoim,
"sabonete dove" devolveu fralda Huggies, e um código que eu chutei como
Kit Kat era Nescafé Matinal 100 g. Foto errada na vitrine é pior que foto
genérica, porque a tripulação pede uma coisa e recebe outra.

Por isso o script só casa por **EAN** ou descobre por **marca** — marca é
vocabulário controlado no acervo, texto livre não é.

### Como rodar

```bash
# A via de produção: os EANs saem da nota do fornecedor
node scripts/catalogo-openfacts.mjs eans 7896089011982 7891991012867 > novos.csv

# Sem a nota em mãos: descobre pelos nomes de marca listados no script
node scripts/catalogo-openfacts.mjs marcas > novos.csv
```

Sai um CSV no formato que **/admin/catalog/import** já aceita, com preço
zerado e `active=false` — preço é decisão de negócio, não de script.
Preencha a coluna `price`, confira as linhas e suba pelo admin.

> **A nota fiscal do fornecedor já é a lista.** O XML da NF-e traz o
> campo `cEAN` de cada item. Exportando esse campo você tem, de graça, a
> relação exata do que entra no estoque — sem digitar código de barras.

### O registro oficial brasileiro

O **Cadastro Nacional de Produtos** da GS1 Brasil é a base oficial: é
dela que sai o EAN, e ela exige foto em alta resolução do fabricante. É
gratuita para associado GS1 e alimenta varejo, e-commerce e Sefaz. Se a
Vessel Supplier se associar (o que já faz sentido para emitir NF-e), essa
é a fonte primária — melhor que qualquer acervo aberto, porque a foto vem
do dono da marca. O script continua útil para o que ainda não estiver lá.

---

## 2. Eletrônico e item de marca sem código na base — media kit

JBL Go 4, powerbank, cabo. Cobertura aberta é quase nula.

A via é o **media kit do fabricante ou do distribuidor**: JBL, Anker,
Baseus e afins publicam packs de imagem para revenda, e o distribuidor
costuma ter um feed de fotos para quem revende. Pedir junto com a
primeira compra é o caminho mais curto — e a foto vem sem obrigação de
crédito, porque a autorização é comercial.

---

## 3. Kit montado por nós — só foto nossa

Snack kit, Hygiene kit, Deck kit, Drinks pack, Cable & adapter kit,
First-need pharmacy, Poker set.

**Nenhum dataset do mundo tem foto disso**, porque o produto não existe
fora da Vessel Supplier — quem decide o que entra na caixa somos nós. Hoje
essas fichas mostram acervo do Wikimedia que só ilustra a categoria: o
café mostra um pacote holandês de museu, e o snack kit mostra Hershey's.

É meia hora de trabalho, uma vez:

1. Monte o kit de verdade sobre uma superfície branca (papel A2 serve).
2. Luz de janela lateral, sem flash. Celular no automático dá conta.
3. Uma foto de frente com tudo à mostra, uma de cima, uma da caixa fechada.
4. Recorte quadrado, 1200 × 1200 px, fundo branco.
5. Suba em **/admin/catalog → produto → Fotos**.

Foto própria de kit vende melhor que foto de banco, porque mostra a
quantidade real. É o que a tripulação quer saber antes de pedir.

---

## Estado atual

- **31 itens reais** carregados como **rascunho** (`active=false`), com
  nome, marca, categoria, EAN e preço inicial. Vieram de `docs/catalogo-inicial.csv`.
- As fotos ainda **não** subiram: gravar no bucket exige sessão de admin,
  e o projeto não tem chave `service_role` de propósito.

Para publicar, um dos dois:

```bash
# a) pela linha de comando
ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD=... \
  node scripts/importar-catalogo.mjs docs/catalogo-inicial.csv
```

**b)** ou pelo próprio admin: `/admin/catalog/import`, subindo
`docs/catalogo-inicial.csv`. Antes de editar o preço, vale conferir as
linhas — o `--seco` mostra o que seria gravado sem gravar nada.

Qualquer um dos dois baixa as 31 fotos, grava no bucket, registra o
crédito em `/attributions` e ativa os produtos. Reimportar depois
atualiza, não duplica, e **não sobrescreve** foto de fornecedor já subida
por cima.
