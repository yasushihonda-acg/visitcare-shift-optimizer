import { resolve } from 'path';

/**
 * データディレクトリを解決する。
 * SEED_DATA_DIR 環境変数が設定されている場合はそちらを優先。
 */
export function getDataDir(callerDir: string): string {
  return process.env.SEED_DATA_DIR
    ? resolve(process.env.SEED_DATA_DIR)
    : resolve(callerDir, '../data');
}
