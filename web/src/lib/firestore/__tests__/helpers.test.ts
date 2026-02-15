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

import { createHelper, updateHelper } from '../helpers';

beforeEach(() => {
  vi.clearAllMocks();
});

function validHelperInput() {
  return {
    name: { family: '鈴木', given: '次郎' },
    qualifications: ['介護福祉士'],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {
      monday: [{ start_time: '09:00', end_time: '17:00' }],
    },
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 8, max: 48 },
    employment_type: 'full_time',
  };
}

describe('createHelper', () => {
  it('正常系: addDocが呼ばれIDが返る', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'new-helper-id' });

    const id = await createHelper(validHelperInput() as never);
    expect(id).toBe('new-helper-id');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it('helpersコレクションに対して書き込む', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'h1' });

    await createHelper(validHelperInput() as never);
    expect(mockCollection).toHaveBeenCalledWith('MOCK_DB', 'helpers');
  });

  it('customer_training_statusが空オブジェクトで初期化される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'h2' });

    await createHelper(validHelperInput() as never);
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.customer_training_status).toEqual({});
  });

  it('created_atとupdated_atにserverTimestampが設定される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'h3' });

    await createHelper(validHelperInput() as never);
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.created_at).toBe('MOCK_TIMESTAMP');
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });
});

describe('updateHelper', () => {
  it('正常系: updateDocが呼ばれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateHelper('helper-id', { can_physical_care: false });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('正しいドキュメント参照で更新する', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateHelper('hlp-123', { transportation: 'bicycle' });
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'helpers', 'hlp-123');
  });

  it('updated_atにserverTimestampが設定される', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateHelper('hlp-456', { can_physical_care: false });
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('部分更新: 指定フィールドのみ含まれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateHelper('hlp-789', { qualifications: ['実務者研修'] });
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.qualifications).toEqual(['実務者研修']);
    expect(writtenData.can_physical_care).toBeUndefined();
  });
});
