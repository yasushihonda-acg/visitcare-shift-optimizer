import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestoreモック
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP');
const mockDoc = vi.fn((..._args: any[]) => 'MOCK_DOC_REF');

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: any[]) => mockSetDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  doc: (...args: any[]) => mockDoc(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: () => 'MOCK_DB',
}));

import { createServiceType, updateServiceType } from '../service-types';

beforeEach(() => {
  vi.clearAllMocks();
});

function validServiceTypeInput() {
  return {
    code: '身体介護2・Ⅱ',
    category: '訪問介護',
    label: '身体介護2・Ⅱ',
    duration: '30分以上60分未満',
    care_level: '要介護1',
    units: 396,
    short_label: '身体介護2・Ⅱ',
    requires_physical_care_cert: true,
    sort_order: 1,
  };
}

describe('createServiceType', () => {
  it('正常系: setDocが呼ばれる', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await createServiceType(validServiceTypeInput());
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('service_typesコレクションのcodeをドキュメントIDとして書き込む', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await createServiceType(validServiceTypeInput());
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'service_types', '身体介護2・Ⅱ');
  });

  it('created_atとupdated_atにserverTimestampが設定される', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await createServiceType(validServiceTypeInput());
    const writtenData = mockSetDoc.mock.calls[0][1];
    expect(writtenData.created_at).toBe('MOCK_TIMESTAMP');
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('全フィールドが書き込まれる', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await createServiceType(validServiceTypeInput());
    const writtenData = mockSetDoc.mock.calls[0][1];
    expect(writtenData.code).toBe('身体介護2・Ⅱ');
    expect(writtenData.category).toBe('訪問介護');
    expect(writtenData.label).toBe('身体介護2・Ⅱ');
    expect(writtenData.duration).toBe('30分以上60分未満');
    expect(writtenData.care_level).toBe('要介護1');
    expect(writtenData.units).toBe(396);
    expect(writtenData.short_label).toBe('身体介護2・Ⅱ');
    expect(writtenData.requires_physical_care_cert).toBe(true);
    expect(writtenData.sort_order).toBe(1);
  });
});

describe('updateServiceType', () => {
  it('正常系: updateDocが呼ばれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateServiceType('physical_care', { label: '身体介護（更新）' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('正しいドキュメント参照で更新する', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateServiceType('daily_living', { sort_order: 10 });
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'service_types', 'daily_living');
  });

  it('updated_atにserverTimestampが設定される', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateServiceType('prevention', { label: '予防' });
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('部分更新: 指定フィールドのみ含まれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateServiceType('private', { requires_physical_care_cert: false });
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.requires_physical_care_cert).toBe(false);
    expect(writtenData.label).toBeUndefined();
  });
});
