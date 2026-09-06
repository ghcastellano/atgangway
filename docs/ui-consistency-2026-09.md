# Consistência da interface — 6 de setembro de 2026

Base revisada: `ad64be00d84659a64cac6aa338208d6af2295670`.

## Regras compartilhadas

- Azul-marinho `--brand` e branco `--on-brand` definem a identidade.
- `05-surfaces.css` concentra a paleta inversa usada pela home, cabeçalho, rodapé e navegação administrativa. Não redefinir a paleta inteira por página.
- A operação usa superfícies claras, os mesmos tokens de contraste da loja e azul nas ações principais. Âmbar, verde e vermelho continuam disponíveis para estados operacionais.
- O CSS administrativo é importado pelo layout de `/admin`; esse layout também declara português e `noindex`. A autorização continua no servidor e nas ações existentes.
- Pedidos e navios compartilham `AdminDrawer`, um diálogo nativo. Foco, Escape e bloqueio do fundo seguem o comportamento do navegador. Avisos são apresentados dentro do diálogo ativo.
- Fontes dos campos móveis usam 16px; controles principais têm área mínima de 44px. Formulários e listas reorganizam suas colunas em telas pequenas; tabelas largas podem rolar dentro da região própria.

## Correções funcionais

- Filtros do admin são botões com estado pressionado, em vez de abas sem navegação correspondente.
- Pedidos têm um botão acessível para abrir detalhes. Teclas em botões de ação não acionam o antigo manipulador da linha.
- Login e recuperação de senha têm estados de carregamento distintos e tratamento de falha de conexão.
- Falhas de transporte em ações otimistas restauram o estado local e pedem conferência do resultado; não repetem automaticamente operações.
- O comando de pular para o conteúdo funciona na loja e no painel.
- Tokens de espaçamento inexistentes no painel do navio foram substituídos pelos tokens reais.

## Descoberta em buscadores

Home, loja, categorias e produtos têm URLs canônicas. Páginas seguintes preservam seu cursor; combinações de busca e filtros recebem `noindex`. O sitemap conserva o limite existente de 5.000 produtos, mas consulta páginas de 1.000 registros para evitar o corte padrão da API. Datas de modificação artificiais foram removidas das páginas fixas.

Referências: [paginação no Google Search](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) e [consultas no Supabase](https://supabase.com/docs/reference/javascript/select).

## Validação e limites

- Compilação Next.js e verificação de TypeScript concluídas localmente, sem credenciais do backend de produção.
- 213 testes passaram, incluindo contraste das superfícies claras e azuis e limites da paginação do sitemap; nenhuma falha.
- Os 54 testes que dependem de navegador/servidor não foram executados. Isso não equivale a uma aprovação visual ou dos fluxos autenticados.
- Antes de promover para produção: conferir home, login, pedidos, navios, catálogo, importação e compras em celular e desktop; verificar foco, confirmação, mensagens e fechamento dos diálogos em uma sessão administrativa autorizada.
- Não foram alterados dados, pagamentos, permissões ou regras de entrega. Publicação em produção não faz parte deste registro de alterações.

## Próximos passos para alcance internacional

A operação atual atende ao Porto de Santos. Crescer internacionalmente exige confirmar a capacidade de entrega em cada novo porto, traduzir a jornada completa nos idiomas escolhidos com dados de demanda e desenvolver parcerias de aquisição com agências e comunidades marítimas. Não anunciar cobertura ou idiomas que a operação ainda não oferece.

Medir a evolução por pedidos entregues por escala, conversão da visita em compra, recompra por tripulante, falhas de checkout e receita por porto. Reconhecimento mundial é uma meta de negócio; esta revisão melhora sua base técnica, sem prometer adoção universal.
