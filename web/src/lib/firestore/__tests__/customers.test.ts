import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestoreモック
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP');
const mockCollection = vi.fn(() => 'MOCK_COLLECTION_REF');
const mockDoc = vi.fn(() => 'MOCK_DOC_REF');

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: () => 'MOCK_DB',
}));

import { createCustomer, updateCustomer } from '../customers';

beforeEach(() => {
  vi.clearAllMocks();
});

function validCustomerInput() {
  return {
    name: { family: '田中', given: '一郎' },
    address: '大阪市北区1-1',
    location: { lat: 34.7025, lng: 135.4959 },
    ng_staff_ids: [],
    preferred_staff_ids: ['H001'],
    weekly_services: {},
    service_manager: 'SM001',
  };
}

describe('createCustomer', () => {
  it('正常系: addDocが呼ばれIDが返る', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'new-customer-id' });

    const id = await createCustomer(validCustomerInput() as never);
    expect(id).toBe('new-customer-id');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it('customersコレクションに対して書き込む', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'c1' });

    await createCustomer(validCustomerInput() as never);
    expect(mockCollection).toHaveBeenCalledWith('MOCK_DB', 'customers');
  });

  it('created_atとupdated_atにserverTimestampが設定される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'c2' });

    await createCustomer(validCustomerInput() as never);
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.created_at).toBe('MOCK_TIMESTAMP');
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('入力データがそのまま書き込まれる', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'c3' });
    const input = validCustomerInput();

    await createCustomer(input as never);
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.name).toEqual(input.name);
    expect(writtenData.address).toBe(input.address);
    expect(writtenData.preferred_staff_ids).toEqual(['H001']);
  });
});

describe('updateCustomer', () => {
  it('正常系: updateDocが呼ばれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateCustomer('existing-id', { address: '新住所' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('正しいドキュメント参照で更新する', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateCustomer('cust-123', { address: '変更先' });
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'customers', 'cust-123');
  });

  it('updated_atにserverTimestampが設定される', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateCustomer('cust-456', { address: '変更先' });
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('部分更新: 指定フィールドのみ含まれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateCustomer('cust-789', { notes: 'テスト備考' });
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.notes).toBe('テスト備考');
    expect(writtenData.address).toBeUndefined();
  });
});
