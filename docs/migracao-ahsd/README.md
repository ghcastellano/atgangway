# Separar o AHSD do banco da Vessel Supplier

O projeto Supabase `cuaocjxofaizefzcxlyc` ("mariners-supply") hospeda hoje
**duas aplicações diferentes**. Além das tabelas da loja, existem:

| Tabela / função | Dono | Conteúdo |
|---|---|---|
| `ahsd_resultados` | app AHSD | 3 linhas de **resultado de instrumento psicométrico** — escore, faixa de severidade, subescalas, respondente |
| `ahsd_admin_config` | app AHSD | hash da senha do painel |
| `ahsd_admin_listar_resultados(p_senha)` | app AHSD | leitura do painel, SECURITY DEFINER |

## Por que separar não é só arrumação

`ahsd_resultados` guarda **dado de saúde**. Pela LGPD isso é dado pessoal
sensível (art. 11), com base legal e dever de segurança próprios — e está
no mesmo banco de uma loja que vai receber pagamento e cadastro de
tripulante. Um vazamento de qualquer um dos dois alcança o outro, e a
chave `anon` publicada no navegador da loja é a mesma chave do projeto
que serve esta tabela.

A política de leitura da tabela é fechada (só existe `INSERT` para
anônimo, e a leitura passa pela função com senha), então **não há
vazamento hoje**. O problema é de arquitetura: dois raios de explosão
colados por conveniência.

## Ordem segura

Dropar primeiro derruba o app AHSD e apaga dado de saúde. A ordem é:

1. Criar um projeto Supabase novo, só do AHSD.
2. Rodar `01-schema.sql` e depois `02-dados.sql` nele.
3. Conferir que o painel do AHSD abre e lista os 3 resultados apontando
   para o banco novo (trocar URL e chave anon no projeto `ahsdtests` na
   Vercel).
4. **Só então** rodar `03-remover-do-banco-da-loja.sql` aqui.

O passo 4 é irreversível. Guarde o dump antes.

## Onde está `02-dados.sql`

Fora deste repositório, de propósito. As 3 linhas de `ahsd_resultados`
são resultado de instrumento psicométrico — escore de GAD-7, indicadores
de AH/SD, sobre-excitabilidades — com nome do respondente. Isso é dado
pessoal **sensível** (LGPD art. 11). Git guarda para sempre e
repositório muda de visibilidade; arquivo assim se passa por fora, se
usa e se apaga.

O arquivo foi entregue no chat. Se perder, o dump se refaz com um
`select` na tabela enquanto ela existir.
