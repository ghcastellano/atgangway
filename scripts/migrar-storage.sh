#!/usr/bin/env bash
# Copia os 43 arquivos do bucket product-images do projeto de ORIGEM
# (mariners-supply) para o de DESTINO (o novo projeto atgangway).
#
# Por que este passo é separado do resto da migração: o banco inteiro
# (schema, dados, auth, segredos, cron) foi clonado via SQL/pg_net, mas
# os ARQUIVOS do Storage moram fora do Postgres. O bucket de origem é
# público, então o download não precisa de chave; o upload no destino
# usa a service key do destino.
#
# Idempotente (x-upsert:true): rodar de novo sobrescreve, não duplica.
#
#   DST_KEY='<service_role key do projeto DESTINO>' bash scripts/migrar-storage.sh
#
# Opcional: SRC_URL / DST_URL já vêm com o padrão certo; sobrescreva se
# os refs mudarem.

set -euo pipefail

SRC_URL="${SRC_URL:-https://cuaocjxofaizefzcxlyc.supabase.co}"   # origem (mariners-supply)
DST_URL="${DST_URL:-https://egrpkdlpsxdcimxuwxhw.supabase.co}"   # destino (atgangway)
: "${DST_KEY:?defina DST_KEY com a service_role key do projeto DESTINO}"

BUCKET="product-images"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

NAMES=(
products/030a24f0-613a-4db3-88e1-dd0479eada63/openfacts.jpg
products/06a001c5-0fc2-4587-9e63-deefbf54d7a8/commons.jpg
products/073830ba-cd71-45bb-a30c-df747dbcbf88/openfacts.jpg
products/0b0eece8-cc95-485f-8621-deab7bb3abf7/openfacts.jpg
products/11bfc689-437c-4a49-9649-34c1998572bb/openfacts.jpg
products/156cce33-e641-4a2d-aa2a-69aa71e434fb/openfacts.jpg
products/20ba898e-b4c7-4cd6-995a-81adf7976181/openfacts.jpg
products/2508ffc2-5aba-4861-91c0-fafd4dec3557/openfacts.jpg
products/26e1d227-a778-4524-a8b2-8cb0fc1c3ecf/commons.jpg
products/38329da7-2acb-4e51-ba08-0accda9eaa39/commons.jpg
products/3975a2e2-284c-426b-9d25-bd09d8357a43/commons.jpg
products/4a3ad242-8a20-4f92-bc8f-397e4bb1d834/openfacts.jpg
products/585e8532-9983-4a1f-bdd2-1802b8e270e3/openfacts.jpg
products/58f40698-3690-4aaf-ab39-e1ed967324ac/openfacts.jpg
products/5a943ab9-2330-4f79-85ef-d5b254985468/openfacts.jpg
products/67a6dd64-7454-46ab-a8ed-eb4a1553a0f9/openfacts.jpg
products/709fd2f9-0379-4ae5-9add-74ca1d2648ef/commons.jpg
products/7472eb3d-2b8a-4ca0-9c35-a1f8b8d4d238/openfacts.jpg
products/7e1b2d55-386c-4f4b-a73d-3becebdf9119/openfacts.jpg
products/7fe7dff0-8b54-4a3a-9b82-c038aca15d85/openfacts.jpg
products/8635a159-737c-4338-83c8-57f0c9d50501/openfacts.jpg
products/87b6f543-72a9-4705-96d6-32f47074359b/openfacts.jpg
products/896ffab1-dd4b-4036-b342-e21cf4e6f38e/openfacts.jpg
products/932d06a3-755a-47f1-99f7-62037236cdc5/openfacts.jpg
products/9b5c61d5-afad-4d1e-a99a-e193d641305f/openfacts.jpg
products/a31dcd36-ef0d-474c-8408-91b9e2d51f88/commons.jpg
products/accda88a-0422-48aa-b051-e48202b9fdfa/openfacts.jpg
products/b198838b-8402-493d-a5a3-eabf6afb9305/openfacts.jpg
products/becaeaee-eba0-4ba8-a839-7898076df4a9/openfacts.jpg
products/bed0d7a4-5076-4528-b89f-9c451a33dd66/openfacts.jpg
products/c445fd9c-9fe3-4210-b048-5a4256f96a9b/openfacts.jpg
products/cb47d027-7979-45c7-aabf-aea6cf0cb103/commons.jpg
products/cbedd08e-c50a-4cda-bf7a-d9fb4ebf9ea0/openfacts.jpg
products/ce3a2cf9-ad9b-46ce-92d7-11412f87a41f/openfacts.jpg
products/d26fb874-7396-4054-957c-395d2527c500/openfacts.jpg
products/e20ea841-c426-4080-a22c-8a2e4e531d72/openfacts.jpg
products/e6cbf6ca-4319-4392-87d9-e7a7ed2917a4/commons.jpg
products/e6ccd6e7-001c-4fd8-b241-5afed2df1d8f/commons.jpg
products/e6e07f07-1cdd-46f3-81b6-9807a2a56c84/commons.jpg
products/effcfc23-d341-41b6-a408-9b5e4c41c1f7/openfacts.jpg
products/f2879690-e37c-4aed-8949-5e5ae56f1937/openfacts.jpg
products/f4be5897-0ac6-410d-a6dd-54214c3419c7/commons.jpg
products/fc6ce5ee-6d53-4b7e-a95b-39576888b04f/commons.jpg
)

ok=0; fail=0
for name in "${NAMES[@]}"; do
  f="$TMP/img.jpg"
  if curl -fsS "$SRC_URL/storage/v1/object/public/$BUCKET/$name" -o "$f"; then
    code=$(curl -s -o /dev/null -w '%{http_code}' \
      -X POST "$DST_URL/storage/v1/object/$BUCKET/$name" \
      -H "Authorization: Bearer $DST_KEY" \
      -H "Content-Type: image/jpeg" \
      -H "x-upsert: true" \
      --data-binary "@$f")
    if [ "$code" = "200" ] || [ "$code" = "201" ]; then
      ok=$((ok+1)); echo "ok   $name"
    else
      fail=$((fail+1)); echo "FAIL($code) $name"
    fi
  else
    fail=$((fail+1)); echo "FAIL(download) $name"
  fi
done

echo
echo "$ok enviados, $fail falharam de ${#NAMES[@]}."
