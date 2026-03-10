import { describe, it, expect } from 'vitest';
import { checkConstraints } from '../checker';
import type { Order, Helper, Customer, StaffUnavailability, ServiceTypeDoc } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'O001',
    customer_id: 'C001',
    week_start_date: new Date('2025-01-06'),
    date: new Date('2025-01-06'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['H001'],
    status: 'assigned',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'H001',
    name: { family: '田中', given: '太郎' },
    qualifications: ['初任者研修'],
    can_physical_care: true,
    transportation: 'bicycle',
    weekly_availability: {
      monday: [{ start_time: '08:00', end_time: '17:00' }],
    },
    preferred_hours: { min: 4, max: 8 },
    available_hours: { min: 4, max: 8 },
    customer_training_status: {},
    employment_type: 'full_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'C001',
    name: { family: '佐藤', given: '花子' },
    address: '東京都',
    location: { lat: 35.6, lng: 139.7 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: '管理者A',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('checkConstraints', () => {
  it('違反なし', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder()],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    expect(result.size).toBe(0);
  });

  it('NGスタッフの検出', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer({ ng_staff_ids: ['H001'] })]]);
    const result = checkConstraints({
      orders: [makeOrder()],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'ng_staff')).toBe(true);
  });

  it('資格不適合（身体介護に無資格者）', () => {
    const helpers = new Map([['H001', makeHelper({ can_physical_care: false })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder({ service_type: 'physical_care' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'qualification')).toBe(true);
  });

  it('生活援助は資格不問', () => {
    const helpers = new Map([['H001', makeHelper({ can_physical_care: false })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder({ service_type: 'daily_living' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'qualification')).toBe(false);
  });

  it('時間重複の検出', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const order1 = makeOrder({ id: 'O001', start_time: '09:00', end_time: '10:00' });
    const order2 = makeOrder({ id: 'O002', start_time: '09:30', end_time: '10:30' });
    const result = checkConstraints({
      orders: [order1, order2],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    expect(result.get('O001')?.some((v) => v.type === 'overlap')).toBe(true);
    expect(result.get('O002')?.some((v) => v.type === 'overlap')).toBe(true);
  });

  it('希望休（終日）の検出', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const unavailability: StaffUnavailability[] = [{
      id: 'U001',
      staff_id: 'H001',
      week_start_date: new Date('2025-01-06'),
      unavailable_slots: [{ date: new Date('2025-01-06'), all_day: true }],
      submitted_at: new Date(),
    }];
    const result = checkConstraints({
      orders: [makeOrder()],
      helpers,
      customers,
      unavailability,
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'unavailability')).toBe(true);
  });

  it('別日の希望休（終日）はオーダー日に影響しない', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    // オーダーは1/6（月）、希望休は1/7（火）
    const unavailability: StaffUnavailability[] = [{
      id: 'U002',
      staff_id: 'H001',
      week_start_date: new Date('2025-01-06'),
      unavailable_slots: [{ date: new Date('2025-01-07'), all_day: true }],
      submitted_at: new Date(),
    }];
    const result = checkConstraints({
      orders: [makeOrder({ date: new Date('2025-01-06') })],
      helpers,
      customers,
      unavailability,
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'unavailability')).toBe(false);
  });

  it('別日の希望休（時間帯）はオーダー日に影響しない', () => {
    const helpers = new Map([['H001', makeHelper()]]);
    const customers = new Map([['C001', makeCustomer()]]);
    // オーダーは1/6（月）09:00-10:00、希望休は1/7（火）09:00-12:00
    const unavailability: StaffUnavailability[] = [{
      id: 'U003',
      staff_id: 'H001',
      week_start_date: new Date('2025-01-06'),
      unavailable_slots: [{
        date: new Date('2025-01-07'),
        all_day: false,
        start_time: '09:00',
        end_time: '12:00',
      }],
      submitted_at: new Date(),
    }];
    const result = checkConstraints({
      orders: [makeOrder({ date: new Date('2025-01-06') })],
      helpers,
      customers,
      unavailability,
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'unavailability')).toBe(false);
  });

  it('serviceTypes の requires_physical_care_cert=true → 資格なしで違反', () => {
    const helpers = new Map([['H001', makeHelper({ can_physical_care: false })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const serviceTypes = new Map<string, ServiceTypeDoc>([
      ['daily_living', { id: 'daily_living', code: 'daily_living', category: '訪問介護', label: '生活援助', duration: '', care_level: '', units: 0, short_label: '生活', requires_physical_care_cert: true, sort_order: 2, created_at: new Date(), updated_at: new Date() }],
    ]);
    const result = checkConstraints({
      orders: [makeOrder({ service_type: 'daily_living' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
      serviceTypes,
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'qualification')).toBe(true);
  });

  it('serviceTypes の requires_physical_care_cert=false → 資格不問', () => {
    const helpers = new Map([['H001', makeHelper({ can_physical_care: false })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const serviceTypes = new Map<string, ServiceTypeDoc>([
      ['physical_care', { id: 'physical_care', code: 'physical_care', category: '訪問介護', label: '身体介護', duration: '', care_level: '', units: 0, short_label: '身体', requires_physical_care_cert: false, sort_order: 1, created_at: new Date(), updated_at: new Date() }],
    ]);
    const result = checkConstraints({
      orders: [makeOrder({ service_type: 'physical_care' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
      serviceTypes,
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'qualification')).toBe(false);
  });

  it('勤務時間外の警告', () => {
    const helpers = new Map([['H001', makeHelper({
      weekly_availability: { monday: [{ start_time: '10:00', end_time: '17:00' }] },
    })]]);
    const customers = new Map([['C001', makeCustomer()]]);
    const result = checkConstraints({
      orders: [makeOrder({ start_time: '09:00', end_time: '10:00' })],
      helpers,
      customers,
      unavailability: [],
      day: 'monday',
    });
    const violations = result.get('O001') ?? [];
    expect(violations.some((v) => v.type === 'outside_hours' && v.severity === 'warning')).toBe(true);
  });

  describe('性別要件', () => {
    it('gender_requirement=female + 男性スタッフ → error violation', () => {
      const helpers = new Map([['H001', makeHelper({ gender: 'male' })]]);
      const customers = new Map([['C001', makeCustomer({ gender_requirement: 'female' })]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'gender' && v.severity === 'error')).toBe(true);
    });

    it('gender_requirement=any → violation なし', () => {
      const helpers = new Map([['H001', makeHelper({ gender: 'male' })]]);
      const customers = new Map([['C001', makeCustomer({ gender_requirement: 'any' })]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'gender')).toBe(false);
    });

    it('gender_requirement 未設定 → violation なし', () => {
      const helpers = new Map([['H001', makeHelper({ gender: 'male' })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'gender')).toBe(false);
    });
  });

  describe('研修状態', () => {
    it('not_visited → error violation', () => {
      const helpers = new Map([['H001', makeHelper({ customer_training_status: { C001: 'not_visited' } })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'training' && v.severity === 'error')).toBe(true);
    });

    it('training → warning violation', () => {
      const helpers = new Map([['H001', makeHelper({ customer_training_status: { C001: 'training' } })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'training' && v.severity === 'warning')).toBe(true);
    });

    it('independent → violation なし', () => {
      const helpers = new Map([['H001', makeHelper({ customer_training_status: { C001: 'independent' } })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'training')).toBe(false);
    });

    it('not_visited + staff_count>1（複数人体制）→ warning（error ではない）', () => {
      const helpers = new Map([
        ['H001', makeHelper({ id: 'H001', customer_training_status: { C001: 'not_visited' } })],
        ['H002', makeHelper({ id: 'H002', name: { family: '鈴木', given: '次郎' } })],
      ]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder({ assigned_staff_ids: ['H001', 'H002'], staff_count: 2 })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      const trainingViolations = violations.filter((v) => v.type === 'training' && v.staffId === 'H001');
      expect(trainingViolations.length).toBe(1);
      expect(trainingViolations[0].severity).toBe('warning');
    });
  });

  describe('staff_count 違反', () => {
    it('staff_count=2, 1人割当 → warning（staff_count_under）', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder({ assigned_staff_ids: ['H001'], staff_count: 2 })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'staff_count_under' && v.severity === 'warning')).toBe(true);
    });

    it('staff_count=2, 2人割当 → 違反なし', () => {
      const helpers = new Map([
        ['H001', makeHelper({ id: 'H001' })],
        ['H002', makeHelper({ id: 'H002' })],
      ]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder({ assigned_staff_ids: ['H001', 'H002'], staff_count: 2 })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'staff_count_under')).toBe(false);
      expect(violations.some((v) => v.type === 'staff_count_over')).toBe(false);
    });

    it('staff_count=1, 2人割当 → error（staff_count_over）', () => {
      const helpers = new Map([
        ['H001', makeHelper({ id: 'H001' })],
        ['H002', makeHelper({ id: 'H002' })],
      ]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder({ assigned_staff_ids: ['H001', 'H002'], staff_count: 1 })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'staff_count_over' && v.severity === 'error')).toBe(true);
    });

    it('staff_count 未指定（デフォルト1）, 1人割当 → 違反なし', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'staff_count_under')).toBe(false);
      expect(violations.some((v) => v.type === 'staff_count_over')).toBe(false);
    });
  });

  describe('移動時間違反', () => {
    it('移動時間不足 → travel_time warning（隣接オーダー双方）', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([
        ['C001', makeCustomer()],
        ['C002', makeCustomer({ id: 'C002' })],
      ]);
      // H001が08:00-09:00(C001) → 09:10-10:00(C002)（ギャップ10分）
      const o1 = makeOrder({ id: 'O001', customer_id: 'C001', start_time: '08:00', end_time: '09:00' });
      const o2 = makeOrder({ id: 'O002', customer_id: 'C002', start_time: '09:10', end_time: '10:00' });
      // C001→C002の移動時間: 20分（ギャップ10分 < 20分）
      const travelTimeLookup = new Map([['C001_C002', 20]]);
      const result = checkConstraints({
        orders: [o1, o2],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
        travelTimeLookup,
      });
      expect(result.get('O001')?.some((v) => v.type === 'travel_time' && v.severity === 'warning')).toBe(true);
      expect(result.get('O002')?.some((v) => v.type === 'travel_time' && v.severity === 'warning')).toBe(true);
    });

    it('移動時間十分 → travel_time violation なし', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([
        ['C001', makeCustomer()],
        ['C002', makeCustomer({ id: 'C002' })],
      ]);
      // ギャップ30分 >= 移動時間20分
      const o1 = makeOrder({ id: 'O001', customer_id: 'C001', start_time: '08:00', end_time: '09:00' });
      const o2 = makeOrder({ id: 'O002', customer_id: 'C002', start_time: '09:30', end_time: '10:00' });
      const travelTimeLookup = new Map([['C001_C002', 20]]);
      const result = checkConstraints({
        orders: [o1, o2],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
        travelTimeLookup,
      });
      expect(result.get('O001')?.some((v) => v.type === 'travel_time')).toBeFalsy();
      expect(result.get('O002')?.some((v) => v.type === 'travel_time')).toBeFalsy();
    });

    it('travelTimeLookup 未提供 → travel_time violation なし', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([
        ['C001', makeCustomer()],
        ['C002', makeCustomer({ id: 'C002' })],
      ]);
      const o1 = makeOrder({ id: 'O001', customer_id: 'C001', start_time: '08:00', end_time: '09:00' });
      const o2 = makeOrder({ id: 'O002', customer_id: 'C002', start_time: '09:10', end_time: '10:00' });
      // travelTimeLookup を渡さない
      const result = checkConstraints({
        orders: [o1, o2],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      expect(result.get('O001')?.some((v) => v.type === 'travel_time')).toBeFalsy();
      expect(result.get('O002')?.some((v) => v.type === 'travel_time')).toBeFalsy();
    });
  });

  describe('推奨スタッフ外', () => {
    it('preferred_staff_ids 外 → warning violation', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer({ preferred_staff_ids: ['H002', 'H003'] })]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'preferred_staff' && v.severity === 'warning')).toBe(true);
    });

    it('preferred_staff_ids 内 → violation なし', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer({ preferred_staff_ids: ['H001', 'H002'] })]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'preferred_staff')).toBe(false);
    });

    it('preferred_staff_ids 空 → violation なし', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer({ preferred_staff_ids: [] })]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'preferred_staff')).toBe(false);
    });
  });

  describe('Firestore配列フィールド欠落への耐性', () => {
    it('ng_staff_ids/preferred_staff_ids が undefined でもクラッシュしない', () => {
      const legacyCustomer = {
        ...makeCustomer(),
        ng_staff_ids: undefined,
        preferred_staff_ids: undefined,
      } as unknown as Customer;
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', legacyCustomer]]);
      expect(() => {
        checkConstraints({
          orders: [makeOrder()],
          helpers,
          customers,
          unavailability: [],
          day: 'monday',
        });
      }).not.toThrow();
    });
  });

  describe('completed/cancelled オーダーの除外', () => {
    it('status=completed のオーダーは違反チェック対象外', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer({ ng_staff_ids: ['H001'] })]]);
      const result = checkConstraints({
        orders: [makeOrder({ status: 'completed' })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      expect(result.size).toBe(0);
    });

    it('status=cancelled のオーダーは違反チェック対象外', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer({ ng_staff_ids: ['H001'] })]]);
      const result = checkConstraints({
        orders: [makeOrder({ status: 'cancelled' })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      expect(result.size).toBe(0);
    });

    it('status=assigned のオーダーは違反チェック対象', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer({ ng_staff_ids: ['H001'] })]]);
      const result = checkConstraints({
        orders: [makeOrder({ status: 'assigned' })],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      expect(result.get('O001')?.some((v) => v.type === 'ng_staff')).toBe(true);
    });
  });

  describe('outside_hours: 未定義曜日のハンドリング', () => {
    it('weekly_availability に該当曜日がない場合は勤務時間外として警告', () => {
      // monday のみ定義、tuesday は未定義
      const helpers = new Map([['H001', makeHelper({
        weekly_availability: { monday: [{ start_time: '08:00', end_time: '17:00' }] },
      })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'tuesday', // monday しか定義されていない
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'outside_hours' && v.severity === 'warning')).toBe(true);
    });

    it('weekly_availability が空オブジェクトの場合は全曜日で勤務時間外', () => {
      const helpers = new Map([['H001', makeHelper({
        weekly_availability: {},
      })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'outside_hours' && v.severity === 'warning')).toBe(true);
    });

    it('weekly_availability 未定義（undefined）の場合は制約なし（違反なし）', () => {
      const helpers = new Map([['H001', makeHelper({
        weekly_availability: undefined as unknown as Helper['weekly_availability'],
      })]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const result = checkConstraints({
        orders: [makeOrder()],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'outside_hours')).toBe(false);
    });
  });

  describe('linked_order_id（同一世帯リンクオーダー）', () => {
    it('リンクオーダーのペアは時間重複として検出しない', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const order1 = makeOrder({
        id: 'O001',
        start_time: '09:00',
        end_time: '10:00',
        linked_order_id: 'O002',
      });
      const order2 = makeOrder({
        id: 'O002',
        start_time: '09:00',
        end_time: '10:00',
        linked_order_id: 'O001',
      });
      const result = checkConstraints({
        orders: [order1, order2],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const v1 = result.get('O001') ?? [];
      const v2 = result.get('O002') ?? [];
      expect(v1.some((v) => v.type === 'overlap')).toBe(false);
      expect(v2.some((v) => v.type === 'overlap')).toBe(false);
    });

    it('リンクオーダーでない重複は引き続き検出する', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const order1 = makeOrder({
        id: 'O001',
        start_time: '09:00',
        end_time: '10:00',
      });
      const order2 = makeOrder({
        id: 'O002',
        start_time: '09:30',
        end_time: '10:30',
      });
      const result = checkConstraints({
        orders: [order1, order2],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const v1 = result.get('O001') ?? [];
      expect(v1.some((v) => v.type === 'overlap')).toBe(true);
    });

    it('同一オーダーが重複入力されても自己重複として検出しない', () => {
      const helpers = new Map([
        ['H001', makeHelper({ id: 'H001' })],
        ['H002', makeHelper({ id: 'H002', name: { family: '松本', given: '花子' } })],
      ]);
      const customers = new Map([['C001', makeCustomer()]]);
      // staff_count=2のオーダーがhelperRows.flatMapで2回入力されるケースを再現
      const order = makeOrder({
        id: 'O001',
        start_time: '09:00',
        end_time: '10:00',
        assigned_staff_ids: ['H001', 'H002'],
        staff_count: 2,
      });
      const result = checkConstraints({
        orders: [order, order], // 同一オーダーが2回
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      const violations = result.get('O001') ?? [];
      expect(violations.some((v) => v.type === 'overlap')).toBe(false);
    });

    it('リンクオーダーでも別の非リンクオーダーとの重複は検出する', () => {
      const helpers = new Map([['H001', makeHelper()]]);
      const customers = new Map([['C001', makeCustomer()]]);
      const linked1 = makeOrder({
        id: 'O001',
        start_time: '09:00',
        end_time: '10:00',
        linked_order_id: 'O002',
      });
      const linked2 = makeOrder({
        id: 'O002',
        start_time: '09:00',
        end_time: '10:00',
        linked_order_id: 'O001',
      });
      const unrelated = makeOrder({
        id: 'O003',
        start_time: '09:30',
        end_time: '10:30',
      });
      const result = checkConstraints({
        orders: [linked1, linked2, unrelated],
        helpers,
        customers,
        unavailability: [],
        day: 'monday',
      });
      // O001 と O003 は重複（リンクではない）
      const v1 = result.get('O001') ?? [];
      expect(v1.filter((v) => v.type === 'overlap').length).toBe(1);
      // O003 は O001, O002 両方と重複
      const v3 = result.get('O003') ?? [];
      expect(v3.filter((v) => v.type === 'overlap').length).toBe(2);
    });
  });
});
