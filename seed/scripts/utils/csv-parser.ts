import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

/**
 * CSVファイルを読み込み、レコード配列として返す
 */
export function parseCSV<T extends Record<string, string>>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}
