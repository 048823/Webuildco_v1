import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows.shift().map((header) => header.trim());
  return rows
    .filter((values) => values.some((value) => value.trim() !== ''))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function stringifyCsv(rows, columns = undefined) {
  const headers = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','));
  }

  return `${lines.join('\n')}\n`;
}

export async function readCsv(filePath) {
  return parseCsv(await readFile(filePath, 'utf8'));
}

export async function writeCsv(filePath, rows, columns = undefined) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyCsv(rows, columns), 'utf8');
}

function escapeCsv(value) {
  const string = String(value);
  if (/[",\n\r]/.test(string)) {
    return `"${string.replaceAll('"', '""')}"`;
  }
  return string;
}
