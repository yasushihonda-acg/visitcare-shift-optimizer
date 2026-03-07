import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestoreモック
const mockGetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP');
const mockCollection = vi.fn((..._args: any[]) => 'MOCK_COLLECTION_REF');
const mockDoc = vi.fn((...args: any[]) => {
  // doc(collection(...)) の場合は自動生成IDを返す
  if (args.length === 1) return { id: 'auto-generated-id' };
  // doc(db, 'customers', id) の場合はMOCK_DOC_REFを返す
  return 'MOCK_DOC_REF';
});
const mockArrayUnion = vi.fn((...args: unknown[]) => ({ type: 'arrayUnion', args }));
const mockArrayRemove = vi.fn((...args: unknown[]) => ({ type: 'arrayRemove', args }));
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch = vi.fn((..._args: any[]) => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));
const mockTransactionGet = vi.fn();
const mockTransactionUpdate = vi.fn();
const mockRunTransaction = vi.fn(async (_db: any, callback: any) => {
  const mockTransaction = {
    get: mockTransactionGet,
    update: mockTransactionUpdate,
    set: vi.fn(),
  };
  return callback(mockTransaction);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => mockServerTimestamp(),
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  arrayRemove: (...args: any[]) => mockArrayRemove(...args),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: () => 'MOCK_DB',
}));

import { createCustomer, updateCustomer } from '../customers';

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルト: transaction.getは空のドキュメントを返す
  mockTransactionGet.mockResolvedValue({
    exists: () => false,
    data: () => undefined,
  });
});

function validCustomerInput() {
  return {
    name: { family: '田中', given: '一郎' },
    address: '大阪市北区1-1',
    location: { lat: 34.7025, lng: 135.4959 },
    ng_staff_ids: [],
    allowed_staff_ids: ['H001'],
    preferred_staff_ids: ['H001'],
    weekly_services: {},
    service_manager: 'SM001',
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
  };
}

describe('createCustomer', () => {
  it('正常系: batch.setとcommitが呼ばれIDが返る', async () => {
    const id = await createCustomer(validCustomerInput() as never);
    expect(id).toBe('auto-generated-id');
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('customersコレクションに対して書き込む', async () => {
    await createCustomer(validCustomerInput() as never);
    expect(mockCollection).toHaveBeenCalledWith('MOCK_DB', 'customers');
  });

  it('created_atとupdated_atにserverTimestampが設定される', async () => {
    await createCustomer(validCustomerInput() as never);
    const writtenData = mockBatchSet.mock.calls[0][1];
    expect(writtenData.created_at).toBe('MOCK_TIMESTAMP');
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('入力データがそのまま書き込まれる', async () => {
    const input = validCustomerInput();

    await createCustomer(input as never);
    const writtenData = mockBatchSet.mock.calls[0][1];
    expect(writtenData.name).toEqual(input.name);
    expect(writtenData.address).toBe(input.address);
    expect(writtenData.preferred_staff_ids).toEqual(['H001']);
  });

  it('同一世帯メンバーがある場合、双方向同期でbatch更新される', async () => {
    const input = { ...validCustomerInput(), same_household_customer_ids: ['C002'] };

    await createCustomer(input as never);
    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});

describe('updateCustomer', () => {
  it('正常系: runTransactionが呼ばれtransaction.updateが実行される', async () => {
    await updateCustomer('existing-id', { address: '新住所' });
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransactionUpdate).toHaveBeenCalled();
  });

  it('正しいドキュメント参照で更新する', async () => {
    await updateCustomer('cust-123', { address: '変更先' });
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'customers', 'cust-123');
  });

  it('updated_atにserverTimestampが設定される', async () => {
    await updateCustomer('cust-456', { address: '変更先' });
    const writtenData = mockTransactionUpdate.mock.calls[0][1];
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('部分更新: 指定フィールドのみ含まれる', async () => {
    await updateCustomer('cust-789', { notes: 'テスト備考' });
    const writtenData = mockTransactionUpdate.mock.calls[0][1];
    expect(writtenData.notes).toBe('テスト備考');
    expect(writtenData.address).toBeUndefined();
  });

  it('同一世帯メンバー変更時に双方向同期が行われる', async () => {
    mockTransactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ same_household_customer_ids: ['C002'], same_facility_customer_ids: [] }),
    });

    await updateCustomer('C001', { same_household_customer_ids: ['C003'] });
    // C002からC001を削除、C003にC001を追加 — すべてtransaction内
    expect(mockRunTransaction).toHaveBeenCalled();
    // 自ドキュメント更新 + C002からの削除 + C003への追加 = 3回
    expect(mockTransactionUpdate).toHaveBeenCalledTimes(3);
  });
});
