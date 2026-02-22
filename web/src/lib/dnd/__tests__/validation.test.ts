import { describe, it, expect } from 'vitest';
import { validateDrop } from '../validation';
import type { Order, Helper, Customer, StaffUnavailability, DayOfWeek, ServiceTypeDoc } from '@/types';

// --- テストヘルパー関数 ---

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    week_start_date: new Date('2026-02-09'),
    date: new Date('2026-02-09'),
    start_time: '09:00',
    end_time: '10:00',
    service_type: 'physical_care',
    assigned_staff_ids: ['helper-a'],
    status: 'assigned',
    manually_edited: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeHelper(overrides: Partial<Helper> = {}): Helper {
  return {
    id: 'helper-b',
    name: { family: '田中', given: '太郎' },
    qualifications: ['初任者研修'],
    can_physical_care: true,
    transportation: 'car',
    weekly_availability: {
      monday: [{ start_time: '08:00', end_time: '18:00' }],
    },
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 0, max: 40 },
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
    id: 'cust-1',
    name: { family: '山田', given: '花子' },
    address: '東京都',
    location: { lat: 35.6, lng: 139.7 },
    ng_staff_ids: [],
    preferred_staff_ids: [],
    weekly_services: {},
    service_manager: 'mgr-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function baseInput() {
  const helper = makeHelper();
  const customer = makeCustomer();
  return {
    order: makeOrder(),
    targetHelperId: 'helper-b',
    helpers: new Map([['helper-b', helper]]),
    customers: new Map([['cust-1', customer]]),
    targetHelperOrders: [] as Order[],
    unavailability: [] as StaffUnavailability[],
    day: 'monday' as DayOfWeek,
  };
}

// --- テストケース ---

describe('validateDrop', () => {
  describe('成功パス', () => {
    it('制約なしで割当可能', () => {
      const result = validateDrop(baseInput());
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(0);
      }
    });
  });

  describe('error制約（ドロップ拒否）', () => {
    it('NGスタッフ → 拒否', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ ng_staff_ids: ['helper-b'] }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('NG');
      }
    });

    it('資格不適合（身体介護 + can_physical_care=false） → 拒否', () => {
      const input = baseInput();
      input.helpers.set('helper-b', makeHelper({ can_physical_care: false }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('資格');
      }
    });

    it('生活援助は資格不問 → 許可', () => {
      const input = baseInput();
      input.order = makeOrder({ service_type: 'daily_living' });
      input.helpers.set('helper-b', makeHelper({ can_physical_care: false }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });

    it('serviceTypes で requires_physical_care_cert=true → 資格なしで拒否', () => {
      const input = baseInput();
      input.order = makeOrder({ service_type: 'daily_living' });
      input.helpers.set('helper-b', makeHelper({ can_physical_care: false }));
      const serviceTypes = new Map<string, ServiceTypeDoc>([
        ['daily_living', { id: 'daily_living', code: 'daily_living', label: '生活援助', short_label: '生活', requires_physical_care_cert: true, sort_order: 2, created_at: new Date(), updated_at: new Date() }],
      ]);

      const result = validateDrop({ ...input, serviceTypes });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('資格');
      }
    });

    it('serviceTypes で requires_physical_care_cert=false → 資格不問で許可', () => {
      const input = baseInput();
      // physical_care はデフォルトでは資格必要だが、serviceTypes で上書き
      input.helpers.set('helper-b', makeHelper({ can_physical_care: false }));
      const serviceTypes = new Map<string, ServiceTypeDoc>([
        ['physical_care', { id: 'physical_care', code: 'physical_care', label: '身体介護', short_label: '身体', requires_physical_care_cert: false, sort_order: 1, created_at: new Date(), updated_at: new Date() }],
      ]);

      const result = validateDrop({ ...input, serviceTypes });
      expect(result.allowed).toBe(true);
    });

    it('時間重複 → 拒否', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '09:30', end_time: '10:30' })];

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('重複');
      }
    });

    it('時間が隣接（重複なし） → 許可', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '10:00', end_time: '11:00' })];

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });

    it('希望休（終日） → 拒否', () => {
      const input = baseInput();
      input.unavailability = [{
        id: 'unavail-1',
        staff_id: 'helper-b',
        week_start_date: new Date('2026-02-09'),
        unavailable_slots: [{ date: new Date('2026-02-09'), all_day: true }],
        submitted_at: new Date(),
      }];

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('希望休');
      }
    });

    it('希望休（時間帯重複） → 拒否', () => {
      const input = baseInput();
      input.unavailability = [{
        id: 'unavail-2',
        staff_id: 'helper-b',
        week_start_date: new Date('2026-02-09'),
        unavailable_slots: [{
          date: new Date('2026-02-09'),
          all_day: false,
          start_time: '09:00',
          end_time: '12:00',
        }],
        submitted_at: new Date(),
      }];

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
    });
  });

  describe('warning制約（ドロップ許可+警告）', () => {
    it('勤務時間外 → 許可 + 警告', () => {
      const input = baseInput();
      // ヘルパーの勤務時間を午後のみに設定
      input.helpers.set('helper-b', makeHelper({
        weekly_availability: {
          monday: [{ start_time: '13:00', end_time: '18:00' }],
        },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('勤務時間外');
      }
    });

    it('勤務時間内 → 許可 + 警告なし', () => {
      const input = baseInput();

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(0);
      }
    });
  });

  describe('性別要件', () => {
    it('gender_requirement=female + 男性ヘルパー → 拒否', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ gender_requirement: 'female' }));
      input.helpers.set('helper-b', makeHelper({ gender: 'male' }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('性別');
      }
    });

    it('gender_requirement=female + 女性ヘルパー → 許可', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ gender_requirement: 'female' }));
      input.helpers.set('helper-b', makeHelper({ gender: 'female' }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });

    it('gender_requirement 未設定 → 許可', () => {
      const input = baseInput();
      input.helpers.set('helper-b', makeHelper({ gender: 'male' }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });
  });

  describe('研修状態', () => {
    it('not_visited → 拒否', () => {
      const input = baseInput();
      input.helpers.set('helper-b', makeHelper({
        customer_training_status: { 'cust-1': 'not_visited' },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('未訪問');
      }
    });

    it('training → 許可 + 警告', () => {
      const input = baseInput();
      input.helpers.set('helper-b', makeHelper({
        customer_training_status: { 'cust-1': 'training' },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('研修中'))).toBe(true);
      }
    });

    it('independent → 許可 + 警告なし', () => {
      const input = baseInput();
      input.helpers.set('helper-b', makeHelper({
        customer_training_status: { 'cust-1': 'independent' },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('研修'))).toBe(false);
      }
    });
  });

  describe('推奨スタッフ', () => {
    it('preferred_staff_ids 外 → 許可 + 警告', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ preferred_staff_ids: ['helper-a', 'helper-c'] }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('推奨スタッフ外'))).toBe(true);
      }
    });

    it('preferred_staff_ids 内 → 許可 + 警告なし', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ preferred_staff_ids: ['helper-b', 'helper-c'] }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('推奨スタッフ外'))).toBe(false);
      }
    });

    it('preferred_staff_ids 空 → 許可 + 警告なし', () => {
      const input = baseInput();
      input.customers.set('cust-1', makeCustomer({ preferred_staff_ids: [] }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('推奨スタッフ外'))).toBe(false);
      }
    });
  });

  describe('staff_count 複数割当', () => {
    it('同一ヘルパー二重割当 → 拒否', () => {
      const input = baseInput();
      // targetHelperId='helper-b' が既にassigned_staff_idsに含まれている
      input.order = makeOrder({ assigned_staff_ids: ['helper-b'] });

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('割当済み');
      }
    });

    it('staff_count=2, 1人割当済み → 許可（追加可能）', () => {
      const input = baseInput();
      input.order = makeOrder({ assigned_staff_ids: ['helper-a'], staff_count: 2 });

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
    });

    it('staff_count=2, 2人割当済み → 許可 + 満員警告', () => {
      const input = baseInput();
      input.order = makeOrder({ assigned_staff_ids: ['helper-a', 'helper-c'], staff_count: 2 });

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('必要人数'))).toBe(true);
      }
    });

    it('staff_count>1 + not_visited → warning（error ではない）', () => {
      const input = baseInput();
      input.order = makeOrder({ assigned_staff_ids: ['helper-a'], staff_count: 2 });
      input.helpers.set('helper-b', makeHelper({
        customer_training_status: { 'cust-1': 'not_visited' },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('未訪問'))).toBe(true);
      }
    });

    it('staff_count=1 + not_visited → error（従来通り）', () => {
      const input = baseInput();
      input.order = makeOrder({ staff_count: 1 });
      input.helpers.set('helper-b', makeHelper({
        customer_training_status: { 'cust-1': 'not_visited' },
      }));

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
    });
  });

  describe('移動時間チェック', () => {
    it('移動時間不足 → 許可 + 警告', () => {
      const input = baseInput();
      // 新オーダー: 利用者cust-2, 09:10-10:00（ギャップ10分）
      input.order = makeOrder({ customer_id: 'cust-2', start_time: '09:10', end_time: '10:00', assigned_staff_ids: [] });
      // ターゲットヘルパーの既存オーダー: 利用者cust-1, 08:00-09:00
      input.targetHelperOrders = [
        makeOrder({ id: 'prev', customer_id: 'cust-1', start_time: '08:00', end_time: '09:00' }),
      ];
      // cust-1→cust-2の移動時間: 20分（ギャップ10分 < 20分）
      const travelTimeLookup = new Map([['cust-1_cust-2', 20]]);

      const result = validateDrop({ ...input, travelTimeLookup });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('移動時間'))).toBe(true);
      }
    });

    it('移動時間十分 → 許可 + 移動時間警告なし', () => {
      const input = baseInput();
      // ギャップ30分 >= 移動時間20分
      input.order = makeOrder({ customer_id: 'cust-2', start_time: '09:30', end_time: '10:00', assigned_staff_ids: [] });
      input.targetHelperOrders = [
        makeOrder({ id: 'prev', customer_id: 'cust-1', start_time: '08:00', end_time: '09:00' }),
      ];
      const travelTimeLookup = new Map([['cust-1_cust-2', 20]]);

      const result = validateDrop({ ...input, travelTimeLookup });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('移動時間'))).toBe(false);
      }
    });

    it('同一利用者 → チェックスキップ（警告なし）', () => {
      const input = baseInput();
      // 前後が同じ利用者 → 移動不要
      input.order = makeOrder({ customer_id: 'cust-1', start_time: '09:10', end_time: '10:00', assigned_staff_ids: [] });
      input.targetHelperOrders = [
        makeOrder({ id: 'prev', customer_id: 'cust-1', start_time: '08:00', end_time: '09:00' }),
      ];
      const travelTimeLookup = new Map([['cust-1_cust-1', 0]]);

      const result = validateDrop({ ...input, travelTimeLookup });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('移動時間'))).toBe(false);
      }
    });

    it('travelTimeLookup 未提供 → チェックスキップ（警告なし）', () => {
      const input = baseInput();
      input.order = makeOrder({ customer_id: 'cust-2', start_time: '09:10', end_time: '10:00', assigned_staff_ids: [] });
      input.targetHelperOrders = [
        makeOrder({ id: 'prev', customer_id: 'cust-1', start_time: '08:00', end_time: '09:00' }),
      ];
      // travelTimeLookup を渡さない

      const result = validateDrop(input);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings.some((w) => w.includes('移動時間'))).toBe(false);
      }
    });
  });

  describe('ヘルパー不在', () => {
    it('存在しないヘルパー → 拒否', () => {
      const input = baseInput();
      input.targetHelperId = 'nonexistent';

      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
    });
  });

  describe('時間軸移動（newStartTime/newEndTime）', () => {
    it('新時刻で重複なし → 許可', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '09:00', end_time: '10:00' })];
      // 元の時間（09:00-10:00）では重複するが、新時刻（11:00-12:00）では重複しない
      const result = validateDrop({ ...input, newStartTime: '11:00', newEndTime: '12:00' });
      expect(result.allowed).toBe(true);
    });

    it('新時刻で重複あり → 拒否', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '11:00', end_time: '12:00' })];
      // 元の時間（09:00-10:00）では重複しないが、新時刻（11:00-12:00）では重複する
      const result = validateDrop({ ...input, newStartTime: '11:00', newEndTime: '12:00' });
      expect(result.allowed).toBe(false);
    });

    it('新時刻が勤務時間外 → 許可 + 警告', () => {
      const input = baseInput();
      // ヘルパー勤務: 08:00-18:00
      const result = validateDrop({ ...input, newStartTime: '18:30', newEndTime: '19:30' });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('勤務時間外');
      }
    });

    it('新時刻が希望休と重複 → 拒否', () => {
      const input = baseInput();
      input.unavailability = [{
        id: 'unavail-1',
        staff_id: 'helper-b',
        week_start_date: new Date('2026-02-09'),
        unavailable_slots: [{
          date: new Date('2026-02-09'),
          all_day: false,
          start_time: '14:00',
          end_time: '16:00',
        }],
        submitted_at: new Date(),
      }];
      // 元の時間（09:00-10:00）では希望休と重複しないが、新時刻（14:30-15:30）では重複
      const result = validateDrop({ ...input, newStartTime: '14:30', newEndTime: '15:30' });
      expect(result.allowed).toBe(false);
    });

    it('newStartTime/newEndTime未指定 → 元の時刻で判定', () => {
      const input = baseInput();
      input.targetHelperOrders = [makeOrder({ id: 'existing', start_time: '09:30', end_time: '10:30' })];
      // 元の時間（09:00-10:00）で重複判定
      const result = validateDrop(input);
      expect(result.allowed).toBe(false);
    });
  });
});
