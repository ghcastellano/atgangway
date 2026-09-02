-- pgTAP para testar RLS e RPCs de dinheiro DENTRO do banco, em
-- transação com rollback. Aplicada via MCP em 2026-09-02.
create extension if not exists pgtap with schema extensions;
