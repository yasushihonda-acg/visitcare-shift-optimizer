import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestoreモック
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP');
const mockDoc = vi.fn(() => 'MOCK_DOC_REF');

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  doc: (...args: unknown[]) => mockDoc(...args),
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
    code: 'physical_care',
    label: '身体介護',
    short_label: '身体',
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
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'service_types', 'physical_care');
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
    expect(writtenData.code).toBe('physical_care');
    expect(writtenData.label).toBe('身体介護');
    expect(writtenData.short_label).toBe('身体');
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
