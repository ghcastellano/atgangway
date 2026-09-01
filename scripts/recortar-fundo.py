#!/usr/bin/env python3
"""
Recorta o fundo das fotos do catálogo e devolve pack shot sobre branco.

Por que isto existe: 42 dos 77 produtos com código de barras NÃO têm
foto de estúdio em acervo aberto nenhum — medido duas vezes, por dois
métodos. As fotos que existem são de voluntário: lata sobre bancada
amarelada, caixa em cima de mesa azul, garrafa na mesa da cozinha. Numa
grade de 24 cards isso lê como loja improvisada, e a foto é tudo o que
a tripulação tem para decidir, porque ela não pode pegar o produto.

Por que é legal fazer isso: as fotos vêm da Open Food Facts / Open
Beauty Facts sob CC-BY-SA, que permite uso comercial E obra derivada,
exigindo atribuição — que a página /attributions já dá. Recortar o
fundo é obra derivada da foto que já temos licença de usar. É o oposto
de pegar pack shot do site do fabricante, que é obra protegida de quem
a gente precisa como fornecedor.

A fonte é a imagem marcada como FRENTE (image_front_url), nunca "a
maior original". A OFF guarda frente, verso, ingredientes e tabela
nutricional no mesmo código de barras; escolher pela área trocou a
água Crystal e o chá Leão pelo painel nutricional do verso. A frente é
a única que o colaborador etiquetou como sendo o produto de frente.

    pip install rembg onnxruntime pillow
    python3 scripts/recortar-fundo.py             # relatório
    python3 scripts/recortar-fundo.py --gravar    # aplica
"""

import io
import json
import os
import sys
import time
import urllib.request

from PIL import Image
from rembg import new_session, remove

DESTINO = "public/produtos"
CACHE = "/tmp/frentes"
UA = "AtGangway/1.0 (help@atgangway.com; catalog product images)"
GRAVAR = "--gravar" in sys.argv

# O mesmo molde de lib/fotonormaliza.ts: 1000px de lado e 6% de folga.
# Dois moldes diferentes para a mesma grade seria pior que fundo sujo.
LADO = 1000
FOLGA = 0.06


def pega(url, chave, binario=True):
    arq = os.path.join(CACHE, chave)
    if os.path.exists(arq):
        with open(arq, "rb") as f:
            return f.read()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                b = r.read()
            with open(arq, "wb") as f:
                f.write(b)
            time.sleep(0.25)
            return b
        except Exception as e:
            if tentativa == 2:
                return None
            time.sleep(2 * (tentativa + 1))
    return None


def frente(ean):
    """URL da foto de FRENTE, em resolução cheia."""
    for host in ("world.openfoodfacts.org", "world.openbeautyfacts.org"):
        b = pega(
            f"https://{host}/api/v2/product/{ean}.json?fields=code,image_front_url",
            f"{ean}.json",
        )
        if not b:
            continue
        try:
            d = json.loads(b)
        except Exception:
            continue
        if d.get("status") != 1:
            continue
        u = (d.get("product") or {}).get("image_front_url")
        if u:
            # .400.jpg é a versão de exibição; .full.jpg é a original.
            return u.replace(".400.jpg", ".full.jpg")
    return None


def cantos_limpos(im):
    """Os 4 cantos claros e parecidos = já é pack shot, não mexe."""
    im = im.convert("RGB")
    w, h = im.size
    lado = max(12, int(min(w, h) * 0.1))
    medias = []
    for cx, cy in ((0, 0), (w - lado, 0), (0, h - lado), (w - lado, h - lado)):
        recorte = im.crop((cx, cy, cx + lado, cy + lado))
        px = list(recorte.getdata())
        medias.append(sum(sum(p) / 3 for p in px) / len(px))
    return min(medias) >= 240 and (max(medias) - min(medias)) < 12


def molde(rgba):
    """Produto recortado -> quadrado branco de 1000px com folga de 6%."""
    caixa = rgba.getbbox()
    if caixa:
        rgba = rgba.crop(caixa)
    miolo = int(LADO * (1 - FOLGA * 2))
    escala = min(miolo / rgba.width, miolo / rgba.height)
    novo = rgba.resize((max(1, int(rgba.width * escala)), max(1, int(rgba.height * escala))), Image.LANCZOS)
    fundo = Image.new("RGB", (LADO, LADO), (255, 255, 255))
    fundo.paste(novo, ((LADO - novo.width) // 2, (LADO - novo.height) // 2), novo)
    return fundo


os.makedirs(CACHE, exist_ok=True)

# u2net (o padrão do rembg) NÃO serve para embalagem, e o estrago foi
# medido: numa passada nas 77 fotos ele apagou o Dr. Oetker inteiro,
# deixou só a tampa da garrafa de água, e transformou o Bis em farelo.
# Ele é treinado para "objeto saliente" em foto genérica, e embalagem
# clara e superfície reflexiva o confundem.
#
# isnet-general-use acerta os dois casos que quebravam o outro — a lata
# amarela sobre bancada amarelada e a garrafa TRANSPARENTE de 5 L, que
# é o caso mais difícil que existe (o fundo aparece através do produto).
sessao = new_session("isnet-general-use")

eans = sorted(
    f[4:-4] for f in os.listdir(DESTINO) if f.startswith("EAN-") and f.endswith(".jpg")
)

recortadas, ja_boas, sem_frente, falhas = [], [], [], []

for ean in eans:
    atual_path = os.path.join(DESTINO, f"EAN-{ean}.jpg")
    try:
        atual = Image.open(atual_path)
    except Exception:
        continue

    u = frente(ean)
    if not u:
        sem_frente.append(ean)
        continue
    bruto = pega(u, f"{ean}-front.bin")
    if not bruto:
        sem_frente.append(ean)
        continue

    try:
        src = Image.open(io.BytesIO(bruto)).convert("RGBA")
    except Exception as e:
        falhas.append(f"{ean} {e}")
        continue

    # Já é pack shot de estúdio? Então recortar só arrisca comer borda
    # de embalagem clara. Não mexe.
    if cantos_limpos(src):
        ja_boas.append(ean)
        continue

    try:
        cortada = remove(src, session=sessao)
        pronta = molde(cortada)
    except Exception as e:
        falhas.append(f"{ean} {e}")
        continue

    # Recorte que sobrou quase nada comeu o produto: descarta.
    proporcao = (cortada.getbbox() or (0, 0, 0, 0))
    area_util = (proporcao[2] - proporcao[0]) * (proporcao[3] - proporcao[1])
    if area_util < 0.05 * src.width * src.height:
        falhas.append(f"{ean} recorte comeu o produto ({area_util} px)")
        continue

    recortadas.append(ean)
    if GRAVAR:
        pronta.save(atual_path, "JPEG", quality=88, subsampling=0, progressive=True)

print(
    f"recortadas {len(recortadas)} | já eram pack shot {len(ja_boas)} | "
    f"sem foto de frente {len(sem_frente)} | falhas {len(falhas)}"
)
for f in falhas:
    print("  falha:", f)
if not GRAVAR:
    print("(relatório apenas — rode com --gravar para aplicar)")
