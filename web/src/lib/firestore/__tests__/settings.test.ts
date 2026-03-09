import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestoreモック
const mockSetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP');
const mockDoc = vi.fn((..._args: any[]) => 'MOCK_DOC_REF');

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  doc: (...args: any[]) => mockDoc(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: () => 'MOCK_DB',
}));

import { updateNotificationSettings } from '../settings';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateNotificationSettings', () => {
  it('正常系: setDocが呼ばれる', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await updateNotificationSettings({ sender_email: 'test@example.com' });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('settings/notificationドキュメントに対して書き込む', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await updateNotificationSettings({ sender_email: 'test@example.com' });
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'settings', 'notification');
  });

  it('sender_emailが書き込みデータに含まれる', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await updateNotificationSettings({ sender_email: 'admin@visitcare.jp' });
    const writtenData = mockSetDoc.mock.calls[0][1];
    expect(writtenData.sender_email).toBe('admin@visitcare.jp');
  });

  it('updated_atにserverTimestampが設定される', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await updateNotificationSettings({ sender_email: 'test@example.com' });
    const writtenData = mockSetDoc.mock.calls[0][1];
    expect(writtenData.updated_at).toBe('MOCK_TIMESTAMP');
  });

  it('merge: trueオプションで呼ばれる', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await updateNotificationSettings({ sender_email: 'test@example.com' });
    const options = mockSetDoc.mock.calls[0][2];
    expect(options).toEqual({ merge: true });
  });

  it('エラー時: Firestoreエラーがそのまま伝播する', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    await expect(
      updateNotificationSettings({ sender_email: 'test@example.com' })
    ).rejects.toThrow('PERMISSION_DENIED');
  });
});
