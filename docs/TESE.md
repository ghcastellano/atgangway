# Vessel Supplier Co.

Sistema de produto e marca (v1) para uma loja de conveniência com **entrega a bordo**
para tripulações de navios em escala no **Porto de Santos** — inspirada no modelo
europeu Sunny (shop.sunny.eu) e ancorada no relacionamento do **Mariners Bar** com as
tripulações.

## A tese

O marítimo muitas vezes não consegue descer para comprar: **25%** passam o contrato
inteiro sem desembarcar e **47%** dos que descem ficam menos de 3h em terra — a barreira
nº 1 é falta de tempo no porto. Quando a pessoa não pode ir até a loja, a loja vai até
ela: pedido antes de atracar, entrega na prancha de embarque, pagamento internacional
no cartão.

## Features do MVP (v1)

| Código | Feature | Prioridade |
|--------|---------|------------|
| SIM-01 | Conectividade primeiro (eSIM / recarga de dados) | Must |
| ETA-02 | Pedido casado com a chegada (pre-order por ETA) | Must |
| GWY-03 | Entrega na prancha, não na cidade | Must |
| PAY-04 | Pagamento internacional sem dinheiro vivo | Must |
| LNG-05 | Inglês primeiro, tripulação multinacional | Should |
| MSG-06 | Pedido nativo em WhatsApp | Should |
| TRK-07 | Status e comprovante de entrega | Could |
| CRW-08 | Pedido coletivo por navio | Could |

## Design System — "Hull & Chart"

- **Paleta:** casco de navio (`#0B222E`), papel de carta náutica (`#E7ECEC`) e uma luz
  de baliza âmbar (`#E7A23A`) como acento único. Vermelho/verde só em status, seguindo o
  código náutico real (bombordo/boreste).
- **Tipografia:** display em caixa-alta com tracking; corpo humanista; dado operacional
  (ETA, berço, preço) sempre em monoespaçada, como num diário de bordo.
- **Responsivo:** mobile-first, testado em mobile (≤640px), iPad (641–1024px) e web.

## Como ver

Abra `index.html` no navegador — é uma página estática, sem build.

## Referências que fundamentam as features

- Seafarers Happiness Index 2025 (Mission to Seafarers) — conectividade "life-changing";
  shore leave como preocupação nº 1.
- World Maritime University / ITF (2024) — 25% sem desembarque; 47% <3h em terra.
- Autoridade Portuária de Santos — 5.708 escalas em 2025.
- shop.sunny.eu — modelo de referência.

---

> Documento de trabalho. Decisões legais (marca "duty free", câmbio, acesso à zona
> primária) seguem a análise de viabilidade: operar 100% formal desde o dia 1.
