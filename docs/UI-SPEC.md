# Especificação de telas — paridade de navegação com shop.sunny.eu

A navegação do Sunny já está validada com a mesma tripulação que vai
usar a nossa. Este documento descreve a ESTRUTURA a espelhar, tirada
dos prints da área logada deles (mobile e desktop).

**Regra de ouro:** estrutura e fluxo iguais; o que muda é a pele
(nosso Hull & Chart, escuro) e o desempenho. Nada de "melhorar"
inventando padrão novo — se o Sunny tem, nós temos, no mesmo lugar.

Onde eu tiver otimizado, está marcado com **[otim]** e explica o
porquê. Otimização não pode mudar o gesto que a pessoa já aprendeu.

---

## 1. Casca (todas as telas)

### 1.1 Barra de anúncio (topo absoluto)
- Fundo âmbar, texto escuro, centralizado, sublinhado, clicável.
- Sunny: "View Catalog & Flyers". Nosso: "View Catalog & Flyers" →
  `/brochures` (a criar) ou, enquanto não existir, `/shop?badge=promo`.
- Altura ~40px. Some ao rolar? **Não** — no Sunny fica fixa no topo do
  documento (rola junto). Manter assim.

### 1.2 Cabeçalho (sticky)
Fundo navy escuro. Duas fileiras:

**Fileira 1** (altura ~56px):
- Esquerda: botão hambúrguer ☰ (abre o drawer de categorias)
- Centro: logo
- Direita, nesta ordem: ícone de conta (👤), wishlist (♡), carrinho (🛒)
  - carrinho tem badge âmbar circular com a contagem, canto superior direito

**Fileira 2** (~56px): campo de busca ocupando toda a largura
- Input branco, cantos arredondados à esquerda
- Botão âmbar quadrado com lupa colado à direita
- Placeholder: "Search entire store here…"
- **[otim]** `font-size: 16px` no input (impede o zoom automático do iOS)
- **[otim]** `type="search"` + `enterKeyHint="search"` (teclado do celular
  mostra "Buscar" em vez de "Enter")

### 1.3 Drawer de categorias (hambúrguer)
Desliza da ESQUERDA, cobre ~85% da largura, fundo claro no Sunny —
no nosso, `--panel`. Overlay escurece o resto.

- Topo: logo centralizado + botão X (quadrado âmbar) à direita
- Corpo: lista vertical de categorias, uma por linha, separadas por
  linha fina. Cada item com nome à esquerda e **chevron ›** à direita
  quando tem filhos.
- **Drill-down, não acordeão.** Tocar no chevron SUBSTITUI a lista pela
  dos filhos, com cabeçalho "‹ Nome da categoria" (voltar) e o primeiro
  item sendo "See all {Nome}".
- Depois das categorias, ainda na mesma lista: "My Account" com ícone.
- Rodapé fixo do drawer: botão âmbar largo "Shopping Cart".
- Fecha com: X, overlay, tecla Esc, ou navegar.
- **[otim]** foco preso dentro do drawer enquanto aberto e `aria-modal`;
  o do Sunny deixa o foco escapar para a página atrás.

### 1.4 Mini-carrinho (ícone do carrinho)
Painel que abre pela direita, título "My Cart" + X circular.
Cada linha:
- miniatura à esquerda (quadrada, fundo branco)
- nome em maiúsculas (2 linhas no máximo)
- preço alinhado à direita
- "Sku {codigo}" em cinza abaixo do nome
- stepper `−  [1]  +` centralizado
- botão editar (lápis, círculo navy) e excluir (lixeira, círculo claro)

Rodapé: "Subtotal" + valor · botão âmbar "Checkout" · botão navy
"View and Edit Cart".

### 1.5 Rodapé
Fundo navy. Seções em **acordeão** (chevron ⌄ à direita), fechadas por
padrão:
- Customer Service
- Relevant Links
- My Account
- Our Offices

Abaixo: fileira de logos de meio de pagamento em cartões brancos.
Depois: "© {ano} All rights reserved — At Gangway" e os links
"Terms & Conditions" · "Privacy Policy".

### 1.6 Menu da conta (ícone 👤)
Dropdown ancorado ao ícone, fundo branco no Sunny — no nosso, `--card`:
- My Account
- My Account Information
- My Orders
- My Recently Viewed Products
- My Wish List
- ——— (separador)
- Sign Out

---

## 2. Home

Ordem vertical exata:
1. Barra de anúncio
2. Cabeçalho
3. Banner/hero (imagem larga; no Sunny é foto de navio porta-contêiner)
4. **"Categories"** — título centralizado
5. **Grade de categorias**: cartões navy, cada um com ícone à esquerda,
   nome, e chevron › à direita.
   - Desktop: 3 colunas. Mobile: 1 coluna (largura cheia).
   - Ordem do Sunny (adaptada ao nosso mix): Promo, New Arrivals,
     Connectivity, Food & Drinks, Beauty & Health, Electronics,
     Fashion, Watches & Jewellery, Travel & Leisure,
     Domestic Appliances, Tools, Tobacco, Outlet
6. **Banner de marca** (carrossel com bolinhas de paginação)
7. **"Items In The Picture"** — fileira horizontal de 4 cards do banner
   atual, com setas ‹ › de navegação
8. Rodapé

---

## 3. Listagem (categoria e busca)

- **UMA coluna no mobile.** (Eu havia feito duas; volta para uma —
  a navegação validada é esta.) Desktop: 3–4 colunas.
- Card, de cima para baixo:
  1. Área de imagem quadrada, **fundo branco**, produto recortado com
     respiro (`object-fit: contain`, padding)
  2. Badge circular no canto superior esquerdo, sobreposto:
     - "Promo" → âmbar · "New" → teal · "Outlet" → cinza
  3. Nome do produto: **MAIÚSCULAS**, centralizado, 2 linhas no máximo
  4. Preço anterior riscado, menor, ACIMA
  5. Preço atual, grande e forte, ABAIXO
  6. Botão âmbar "🛒 Add to Cart" ocupando quase toda a largura
  7. Coração de wishlist em círculo claro, à direita do botão
- Esgotado: no Sunny aparece "Coming Soon" com ícone de relógio no
  lugar do botão. Nosso: "Out of stock" (mais honesto; "em breve"
  promete o que não sabemos cumprir) — **[otim]** de texto, não de layout.

**[otim] de desempenho, sem mexer no layout:**
- `next/image` com `sizes` correto e AVIF/WebP
- as 4 primeiras imagens com `priority`, o resto `loading="lazy"`
- Server Component: o card não vira JavaScript no cliente, só o botão

---

## 4. Ficha de produto

Ordem exata:
1. Imagem principal grande, quadrada, fundo branco
   - badge circular no canto superior esquerdo
   - ícone de expandir (⤢) no canto superior direito, em círculo claro
2. Carrossel de miniaturas horizontal, com setas ‹ › nas pontas
   - miniatura ativa com **borda âmbar**
3. Cartão de informação:
   - "● In stock" com bolinha VERDE (ou cinza se esgotado)
   - tabela de duas colunas, uma linha por atributo, separadas por
     linha fina: **SKU**, depois cada opção da variante (Color, Size…)
   - preço grande alinhado à DIREITA
   - abaixo: campo de quantidade (caixa com número) + botão âmbar de
     carrinho quadrado, lado a lado
   - abaixo: "$ 114,34 (US Dollar by current exchange rate)" — conversão
     de referência em cinza pequeno
   - coração de wishlist alinhado à direita
4. **"Description / {NOME DO PRODUTO}"** — título da seção
   - nome do produto repetido em negrito
   - lista de marcadores com **bolinha âmbar**, uma linha por
     especificação
5. **Barra fixa de compra no rodapé** (aparece ao rolar):
   - miniatura + nome (2 linhas) + preço + botão âmbar de carrinho
6. Rodapé do site

---

## 5. Carrinho (`/cart`)

1. Banner de pedido mínimo, **dispensável com X**: "Minimum order
   amount 126 EUR" (nosso: valor do porto, em USD). Fundo azul claro,
   borda azul. Só aparece quando o subtotal está abaixo do mínimo.
2. Título grande "Shopping Cart"
3. Cartão "Summary":
   - "Products:" ····· contagem (negrito à direita)
   - "Apply Discount Code ⌄" (recolhível) — nosso: crédito Captain
   - linha fina
   - "Subtotal" ····· valor
   - linha fina
   - "**Grand Total**" ····· valor grande
   - botão âmbar largo "Proceed to Checkout"
   - botão navy largo "Return to shopping"
4. Lista de itens (mesma anatomia do mini-carrinho)

---

## 6. Checkout (`/checkout`)

Tela "Personal details" — **não é formulário de endereço.** É um
cartão de CONFIRMAÇÃO com borda âmbar, lendo do perfil:

- Name — valor em negrito navy
- Rank — valor em negrito
- Vessel — **miniatura da foto do navio** + "NOME [BANDEIRA]"
- Port — se faltar: rótulo em VERMELHO + "Port is required.
  **Please update your profile.**" (link)
- Email
- Telephone
- Rodapé do cartão: "Need to change these details? 👤 **Update your
  profile**"

Abaixo: botão âmbar largo "Proceed to Payment".

Consequência de modelagem, já implementada: navio, rank e porto moram
no **perfil**, não no pedido.

---

## 7. Cadastro (`/signup`)

Modal escuro "Register to shop", campos nesta ordem (todos com
asterisco vermelho quando obrigatórios):
1. Email *
2. Password * — com medidor "Password Strength: …" e olho de revelar
3. Confirm Password * — com olho
4. First Name *
5. Last Name *
6. Telephone number * — seletor de bandeira + DDI, depois o número
7. **Your vessel *** — typeahead: "Enter your imo or Vessel name to
   search"; ao focar mostra "**+ Create a new Vessel**" e a dica
   "Type 3 or more characters to search for vessels"
8. Rank * — select com busca
9. Nationality * — select com busca
10. Toggle "I accept the terms and conditions"
11. Botão "Create an Account"
12. "Already have an account? **Login here**"

Login é um modal separado: Email, Password (olho), toggle "Stay logged
in", "Forgot Your Password?", botão âmbar "Login", "Don't have an
account? Register here".

---

## 8. Wishlist (`/wishlist`)

- Título "My Wish List"
- Select "My Account" (navegação entre seções da conta)
- Vazio: caixa azul clara "You have no items in your wish list."
- Link "Back"

---

## 9. Brochures (`/brochures`)

- Migalha "Home › Brochures"
- Título "Brochures" com sublinhado âmbar
- Lista vertical de capas de catálogo, cada uma com legenda em barra
  cinza escura: "CATEGORIA - PERÍODO - ANO - MARCA - NN"

---

## Resumo do que otimizo sem mexer na navegação

| Otimização | Por quê |
|---|---|
| Server Components na listagem e na ficha | o card do Sunny é Magento com JS pesado; o nosso não vira JavaScript no cliente |
| Paginação por keyset | página 80 custa o mesmo que a 1 |
| `next/image` AVIF/WebP + `sizes` | foto de catálogo no wifi de navio |
| Busca com trigram | "powerbnk" acha Powerbank |
| Input 16px, `enterKeyHint` | teclado do celular sem zoom involuntário |
| Foco preso no drawer, `aria-modal` | acessibilidade que o deles não tem |
| "Out of stock" no lugar de "Coming Soon" | não prometer o que não sabemos cumprir |
