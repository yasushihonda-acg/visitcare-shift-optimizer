import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestoreモック
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'MOCK_TIMESTAMP');
const mockCollection = vi.fn((..._args: any[]) => 'MOCK_COLLECTION_REF');
const mockDoc = vi.fn((..._args: any[]) => 'MOCK_DOC_REF');
const mockTimestampFromDate = vi.fn((date: Date) => ({ toDate: () => date, _type: 'Timestamp', _date: date }));

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  Timestamp: {
    fromDate: (date: Date) => mockTimestampFromDate(date),
  },
}));

vi.mock('@/lib/firebase', () => ({
  getDb: () => 'MOCK_DB',
}));

import {
  createStaffUnavailability,
  updateStaffUnavailability,
  deleteStaffUnavailability,
} from '../staff-unavailability';

beforeEach(() => {
  vi.clearAllMocks();
});

function validInput() {
  return {
    staff_id: 'helper-001',
    week_start_date: new Date('2026-03-09'),
    unavailable_slots: [
      { date: new Date('2026-03-10'), all_day: true },
    ],
    notes: '通院のため',
  };
}

describe('createStaffUnavailability', () => {
  it('正常系: addDocが呼ばれIDが返る', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'unavail-001' });

    const id = await createStaffUnavailability(validInput());
    expect(id).toBe('unavail-001');
  });

  it('staff_unavailabilityコレクションに対して書き込む', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u1' });

    await createStaffUnavailability(validInput());
    expect(mockCollection).toHaveBeenCalledWith('MOCK_DB', 'staff_unavailability');
  });

  it('staff_idが書き込みデータに含まれる', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u2' });

    await createStaffUnavailability(validInput());
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.staff_id).toBe('helper-001');
  });

  it('week_start_dateがTimestamp.fromDateで変換される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u3' });

    const input = validInput();
    await createStaffUnavailability(input);
    expect(mockTimestampFromDate).toHaveBeenCalledWith(input.week_start_date);
  });

  it('unavailable_slotsのdateがTimestamp.fromDateで変換される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u4' });

    const input = validInput();
    await createStaffUnavailability(input);
    expect(mockTimestampFromDate).toHaveBeenCalledWith(input.unavailable_slots[0].date);
  });

  it('all_dayスロットにstart_time/end_timeが含まれない', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u5' });

    await createStaffUnavailability(validInput());
    const writtenData = mockAddDoc.mock.calls[0][1];
    const slot = writtenData.unavailable_slots[0];
    expect(slot.all_day).toBe(true);
    expect(slot.start_time).toBeUndefined();
    expect(slot.end_time).toBeUndefined();
  });

  it('時間指定スロットにstart_time/end_timeが含まれる', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u6' });

    const input = {
      ...validInput(),
      unavailable_slots: [
        { date: new Date('2026-03-10'), all_day: false, start_time: '09:00', end_time: '12:00' },
      ],
    };
    await createStaffUnavailability(input);
    const writtenData = mockAddDoc.mock.calls[0][1];
    const slot = writtenData.unavailable_slots[0];
    expect(slot.start_time).toBe('09:00');
    expect(slot.end_time).toBe('12:00');
  });

  it('notesが未指定の場合nullが設定される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u7' });

    const input = { ...validInput(), notes: undefined };
    await createStaffUnavailability(input);
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.notes).toBeNull();
  });

  it('submitted_atにserverTimestampが設定される', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'u8' });

    await createStaffUnavailability(validInput());
    const writtenData = mockAddDoc.mock.calls[0][1];
    expect(writtenData.submitted_at).toBe('MOCK_TIMESTAMP');
  });

  it('エラー時: Firestoreエラーがそのまま伝播する', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    await expect(createStaffUnavailability(validInput())).rejects.toThrow('PERMISSION_DENIED');
  });
});

describe('updateStaffUnavailability', () => {
  it('正常系: updateDocが呼ばれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateStaffUnavailability('unavail-001', validInput());
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('正しいドキュメント参照で更新する', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateStaffUnavailability('unavail-123', validInput());
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'staff_unavailability', 'unavail-123');
  });

  it('staff_idが更新データに含まれる', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateStaffUnavailability('u1', validInput());
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.staff_id).toBe('helper-001');
  });

  it('week_start_dateがTimestamp.fromDateで変換される', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    const input = validInput();
    await updateStaffUnavailability('u2', input);
    expect(mockTimestampFromDate).toHaveBeenCalledWith(input.week_start_date);
  });

  it('unavailable_slotsが正しく変換される', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    const input = {
      ...validInput(),
      unavailable_slots: [
        { date: new Date('2026-03-11'), all_day: false, start_time: '14:00', end_time: '17:00' },
      ],
    };
    await updateStaffUnavailability('u3', input);
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    const slot = writtenData.unavailable_slots[0];
    expect(slot.all_day).toBe(false);
    expect(slot.start_time).toBe('14:00');
    expect(slot.end_time).toBe('17:00');
  });

  it('submitted_atにserverTimestampが設定される', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    await updateStaffUnavailability('u4', validInput());
    const writtenData = mockUpdateDoc.mock.calls[0][1];
    expect(writtenData.submitted_at).toBe('MOCK_TIMESTAMP');
  });

  it('エラー時: Firestoreエラーがそのまま伝播する', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('NOT_FOUND'));

    await expect(
      updateStaffUnavailability('nonexistent', validInput())
    ).rejects.toThrow('NOT_FOUND');
  });
});

describe('deleteStaffUnavailability', () => {
  it('正常系: deleteDocが呼ばれる', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    await deleteStaffUnavailability('unavail-001');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('正しいドキュメント参照で削除する', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    await deleteStaffUnavailability('unavail-456');
    expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', 'staff_unavailability', 'unavail-456');
  });

  it('エラー時: Firestoreエラーがそのまま伝播する', async () => {
    mockDeleteDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    await expect(deleteStaffUnavailability('unavail-001')).rejects.toThrow('PERMISSION_DENIED');
  });
});
