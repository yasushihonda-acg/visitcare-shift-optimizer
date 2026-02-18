import { describe, it, expect } from 'vitest';
import { customerSchema, helperSchema, unavailabilitySchema } from '../schemas';

// ---- テストヘルパー ----

function validCustomer() {
  return {
    name: { family: '山田', given: '太郎' },
    address: '東京都新宿区1-1-1',
    location: { lat: 35.6895, lng: 139.6917 },
    ng_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    service_manager: 'SM001',
  };
}

function validHelper() {
  return {
    name: { family: '佐藤', given: '花子' },
    qualifications: ['初任者研修'],
    can_physical_care: true,
    transportation: 'car' as const,
    weekly_availability: {},
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 8, max: 48 },
    employment_type: 'full_time' as const,
  };
}

function validUnavailability() {
  return {
    staff_id: 'H001',
    week_start_date: '2026-02-09',
    unavailable_slots: [{ date: '2026-02-10', all_day: true }],
  };
}

// ================================================================
// customerSchema
// ================================================================
describe('customerSchema', () => {
  it('正常値でパースできる', () => {
    const result = customerSchema.safeParse(validCustomer());
    expect(result.success).toBe(true);
  });

  it('オプションフィールド付きでパースできる', () => {
    const result = customerSchema.safeParse({
      ...validCustomer(),
      household_id: 'HH001',
      notes: '備考テスト',
      name: { family: '山田', given: '太郎', short: 'ヤマダ' },
    });
    expect(result.success).toBe(true);
  });

  it('姓が空文字の場合エラー', () => {
    const data = { ...validCustomer(), name: { family: '', given: '太郎' } };
    const result = customerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('名が空文字の場合エラー', () => {
    const data = { ...validCustomer(), name: { family: '山田', given: '' } };
    const result = customerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('住所が空文字の場合エラー', () => {
    const data = { ...validCustomer(), address: '' };
    const result = customerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('サービス提供責任者が空文字の場合エラー', () => {
    const data = { ...validCustomer(), service_manager: '' };
    const result = customerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('緯度の境界値: -90はOK', () => {
    const data = { ...validCustomer(), location: { lat: -90, lng: 0 } };
    expect(customerSchema.safeParse(data).success).toBe(true);
  });

  it('緯度の境界値: 90はOK', () => {
    const data = { ...validCustomer(), location: { lat: 90, lng: 0 } };
    expect(customerSchema.safeParse(data).success).toBe(true);
  });

  it('緯度の境界値: -91はエラー', () => {
    const data = { ...validCustomer(), location: { lat: -91, lng: 0 } };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('緯度の境界値: 91はエラー', () => {
    const data = { ...validCustomer(), location: { lat: 91, lng: 0 } };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('経度の境界値: -180はOK', () => {
    const data = { ...validCustomer(), location: { lat: 0, lng: -180 } };
    expect(customerSchema.safeParse(data).success).toBe(true);
  });

  it('経度の境界値: 181はエラー', () => {
    const data = { ...validCustomer(), location: { lat: 0, lng: 181 } };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('NG/推奨スタッフ配列を持てる', () => {
    const data = {
      ...validCustomer(),
      ng_staff_ids: ['H001', 'H002'],
      preferred_staff_ids: ['H003'],
    };
    expect(customerSchema.safeParse(data).success).toBe(true);
  });

  it('weekly_servicesにサービススロットを含められる', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          {
            start_time: '09:00',
            end_time: '10:00',
            service_type: 'physical_care',
            staff_count: 1,
          },
        ],
      },
    };
    expect(customerSchema.safeParse(data).success).toBe(true);
  });

  it('serviceSlotのstaff_countが0の場合エラー', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          {
            start_time: '09:00',
            end_time: '10:00',
            service_type: 'physical_care',
            staff_count: 0,
          },
        ],
      },
    };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('serviceSlotのstaff_countが4の場合エラー（上限3）', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          {
            start_time: '09:00',
            end_time: '10:00',
            service_type: 'daily_living',
            staff_count: 4,
          },
        ],
      },
    };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('serviceSlotの不正なservice_typeはエラー', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          {
            start_time: '09:00',
            end_time: '10:00',
            service_type: 'invalid_type',
            staff_count: 1,
          },
        ],
      },
    };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('時刻が不正な形式（H:MM）の場合エラー', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          {
            start_time: '9:00',
            end_time: '10:00',
            service_type: 'physical_care',
            staff_count: 1,
          },
        ],
      },
    };
    expect(customerSchema.safeParse(data).success).toBe(false);
  });

  it('同一曜日で時間帯が重複するスロットはエラー', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:30', service_type: 'physical_care', staff_count: 1 },
          { start_time: '10:00', end_time: '11:00', service_type: 'daily_living', staff_count: 1 },
        ],
      },
    };
    const result = customerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('同一曜日で境界接触（端と端が一致）は重複とみなさない', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
          { start_time: '10:00', end_time: '11:00', service_type: 'daily_living', staff_count: 1 },
        ],
      },
    };
    expect(customerSchema.safeParse(data).success).toBe(true);
  });

  it('複数曜日で各曜日が独立して重複チェックされる', () => {
    const data = {
      ...validCustomer(),
      weekly_services: {
        monday: [
          { start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 },
        ],
        wednesday: [
          { start_time: '13:00', end_time: '14:30', service_type: 'physical_care', staff_count: 1 },
          { start_time: '14:00', end_time: '15:00', service_type: 'daily_living', staff_count: 1 },
        ],
      },
    };
    const result = customerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ================================================================
// helperSchema
// ================================================================
describe('helperSchema', () => {
  it('正常値でパースできる', () => {
    expect(helperSchema.safeParse(validHelper()).success).toBe(true);
  });

  it('姓が空文字の場合エラー', () => {
    const data = { ...validHelper(), name: { family: '', given: '花子' } };
    expect(helperSchema.safeParse(data).success).toBe(false);
  });

  it('不正なtransportation値はエラー', () => {
    const data = { ...validHelper(), transportation: 'train' };
    expect(helperSchema.safeParse(data).success).toBe(false);
  });

  it('不正なemployment_type値はエラー', () => {
    const data = { ...validHelper(), employment_type: 'contract' };
    expect(helperSchema.safeParse(data).success).toBe(false);
  });

  it('preferred_hours.minが負の場合エラー', () => {
    const data = { ...validHelper(), preferred_hours: { min: -1, max: 40 } };
    expect(helperSchema.safeParse(data).success).toBe(false);
  });

  it('available_hours.minが0はOK（境界値）', () => {
    const data = { ...validHelper(), available_hours: { min: 0, max: 0 } };
    expect(helperSchema.safeParse(data).success).toBe(true);
  });

  it('資格配列が空でもOK', () => {
    const data = { ...validHelper(), qualifications: [] };
    expect(helperSchema.safeParse(data).success).toBe(true);
  });

  it('weekly_availabilityに勤務スロットを含められる', () => {
    const data = {
      ...validHelper(),
      weekly_availability: {
        monday: [{ start_time: '09:00', end_time: '17:00' }],
        wednesday: [{ start_time: '10:00', end_time: '15:00' }],
      },
    };
    expect(helperSchema.safeParse(data).success).toBe(true);
  });

  it('weekly_availabilityの不正な時刻形式はエラー', () => {
    const data = {
      ...validHelper(),
      weekly_availability: {
        monday: [{ start_time: '9:00', end_time: '17:00' }],
      },
    };
    expect(helperSchema.safeParse(data).success).toBe(false);
  });
});

// ================================================================
// unavailabilitySchema
// ================================================================
describe('unavailabilitySchema', () => {
  it('正常値（終日）でパースできる', () => {
    expect(unavailabilitySchema.safeParse(validUnavailability()).success).toBe(true);
  });

  it('時間指定スロットでパースできる', () => {
    const data = {
      ...validUnavailability(),
      unavailable_slots: [
        { date: '2026-02-10', all_day: false, start_time: '09:00', end_time: '12:00' },
      ],
      notes: '午前のみ不在',
    };
    expect(unavailabilitySchema.safeParse(data).success).toBe(true);
  });

  it('staff_idが空文字の場合エラー', () => {
    const data = { ...validUnavailability(), staff_id: '' };
    expect(unavailabilitySchema.safeParse(data).success).toBe(false);
  });

  it('week_start_dateが空文字の場合エラー', () => {
    const data = { ...validUnavailability(), week_start_date: '' };
    expect(unavailabilitySchema.safeParse(data).success).toBe(false);
  });

  it('unavailable_slotsが空配列の場合エラー', () => {
    const data = { ...validUnavailability(), unavailable_slots: [] };
    expect(unavailabilitySchema.safeParse(data).success).toBe(false);
  });

  it('スロットのdateが空文字の場合エラー', () => {
    const data = {
      ...validUnavailability(),
      unavailable_slots: [{ date: '', all_day: true }],
    };
    expect(unavailabilitySchema.safeParse(data).success).toBe(false);
  });

  it('複数スロットでパースできる', () => {
    const data = {
      ...validUnavailability(),
      unavailable_slots: [
        { date: '2026-02-10', all_day: true },
        { date: '2026-02-11', all_day: false, start_time: '14:00', end_time: '18:00' },
      ],
    };
    expect(unavailabilitySchema.safeParse(data).success).toBe(true);
  });
});
