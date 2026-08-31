/**
 * CSV para importação de catálogo.
 *
 * Escrito à mão em vez de biblioteca porque o problema real não é
 * separar por vírgula — é sobreviver ao que sai do Excel do
 * fornecedor: campo entre aspas com vírgula dentro ("Cabo USB-C, 2m"),
 * aspas escapadas por duplicação, quebra de linha DENTRO do campo
 * (descrição em várias linhas), BOM no começo do arquivo e CRLF.
 * Cada um desses tem teste.
 *
 * Puro de propósito: parsing é onde a importação erra, e erro de
 * parsing só aparece no arquivo real do cliente. Melhor que o teste
 * chegue antes.
 */

export type CsvRow = Record<string, string>;

/** Divide respeitando aspas. Devolve matriz crua, sem cabeçalho. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  // BOM do Excel vira um caractere invisível no primeiro cabeçalho e
  // faz "sku" nunca casar com "﻿sku".
  let text = input.replace(/^﻿/, "");
  const delim = delimiter ?? sniffDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Linha em branco no fim do arquivo não é registro.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // aspas escapadas por duplicação
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"' && field === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delim) {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++; // CRLF: o \n seguinte fecha a linha
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

/** Excel brasileiro salva com ponto e vírgula. Decide pela 1ª linha. */
export function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => ({
    d,
    n: firstLine.split(d).length - 1,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

/** Normaliza cabeçalho: "Preço de Venda" → "preco_de_venda". */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Matriz → objetos com chave normalizada. Colunas a mais são ignoradas. */
export function toRows(matrix: string[][]): CsvRow[] {
  if (matrix.length === 0) return [];
  const headers = matrix[0].map(normalizeHeader);
  const out: CsvRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    // Linha totalmente vazia entre blocos é ruído do Excel, não registro.
    if (cells.every((c) => c.trim() === "")) continue;
    const obj: CsvRow = {};
    headers.forEach((h, c) => {
      if (h) obj[h] = (cells[c] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

export function parseCsvRows(input: string): CsvRow[] {
  return toRows(parseCsv(input));
}
