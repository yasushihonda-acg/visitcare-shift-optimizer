import { describe, it, expect } from 'vitest';
import { formatFullName, formatCompactName, formatDisplayName, formatFullNameKana } from '../name';
import type { PersonName } from '@/types';

const name: PersonName = {
  family: '山田',
  given: '太郎',
  short: '太郎',
  family_kana: 'ヤマダ',
  given_kana: 'タロウ',
};

describe('formatFullName', () => {
  it('スペース区切りのフルネームを返す', () => {
    expect(formatFullName(name)).toBe('山田 太郎');
  });
});

describe('formatCompactName', () => {
  it('スペースなしのフルネームを返す', () => {
    expect(formatCompactName(name)).toBe('山田太郎');
  });
});

describe('formatDisplayName', () => {
  it('shortがある場合はshortを返す', () => {
    expect(formatDisplayName(name)).toBe('太郎');
  });

  it('shortがない場合はコンパクト名を返す', () => {
    const noShort: PersonName = { family: '山田', given: '太郎' };
    expect(formatDisplayName(noShort)).toBe('山田太郎');
  });
});

describe('formatFullNameKana', () => {
  it('カナのフルネームを返す', () => {
    expect(formatFullNameKana(name)).toBe('ヤマダ タロウ');
  });

  it('カナがない場合は空文字を返す', () => {
    const noKana: PersonName = { family: '山田', given: '太郎' };
    expect(formatFullNameKana(noKana)).toBe('');
  });
});
