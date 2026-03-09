import { describe, it, expect } from 'vitest';
import { buildCustomerDetailViewModel } from '../customerDetailViewModel';
import type { Customer, Helper, ServiceTypeDoc } from '@/types';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: { family: '田中', given: '花子' },
    address: '東京都新宿区1-1-1',
    location: { lat: 35.6895, lng: 139.6917 },
    ng_staff_ids: [],
    allowed_staff_ids: [],
    preferred_staff_ids: [],
    same_household_customer_ids: [],
    same_facility_customer_ids: [],
    weekly_services: {},
    service_manager: '山田太郎',
    gender_requirement: 'any',
    created_at: new Date('2025-01-01T00:00:00'),
    updated_at: new Date('2025-06-01T00:00:00'),
    ...overrides,
  };
}

function makeHelper(id: string, family: string, given: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
    can_physical_care: false,
    transportation: 'bicycle',
    weekly_availability: {},
    preferred_hours: { min: 20, max: 40 },
    available_hours: { min: 20, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time',
    gender: 'female',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const emptyHelpers = new Map<string, Helper>();
const emptyCustomers = new Map<string, Customer>();
const emptyServiceTypes = new Map<string, ServiceTypeDoc>();

const sampleServiceTypes = new Map<string, ServiceTypeDoc>([
  ['physical_care', {
    id: 'physical_care', code: 'physical_care', label: '身体介護',
    short_label: '身体', requires_physical_care_cert: true, sort_order: 1,
    category: 'care', duration: '60分以上', care_level: 'level1', units: 100,
    created_at: new Date(), updated_at: new Date(),
  } as ServiceTypeDoc],
]);

describe('buildCustomerDetailViewModel', () => {
  it('基本フィールドが正しく変換される', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer(), emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.fullName).toBe('田中 花子');
    expect(vm.address).toBe('東京都新宿区1-1-1');
    expect(vm.serviceManager).toBe('山田太郎');
    expect(vm.genderRequirementLabel).toBe('指定なし');
  });

  it('ふりがながある場合 fullKana が設定される', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ name: { family: '田中', given: '花子', family_kana: 'たなか', given_kana: 'はなこ' } }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.fullKana).toBe('たなか はなこ');
  });

  it('ふりがながない場合 fullKana が null', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer(), emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.fullKana).toBeNull();
  });

  it('NGスタッフがヘルパーMapから名前解決される', () => {
    const helpers = new Map([['h-1', makeHelper('h-1', '鈴木', '一郎')]]);
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ ng_staff_ids: ['h-1'] }),
      helpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.ngStaff).toEqual([{ id: 'h-1', name: '鈴木 一郎', isPreferred: false }]);
  });

  it('NGスタッフでヘルパーMapに存在しないIDはフィルタされる', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ ng_staff_ids: ['h-unknown'] }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.ngStaff).toEqual([]);
  });

  it('preferredStaff が正しく解決される（allowed に含まれないものだけ）', () => {
    const helpers = new Map([
      ['h-1', makeHelper('h-1', '鈴木', '一郎')],
      ['h-2', makeHelper('h-2', '高橋', '二郎')],
    ]);
    const vm = buildCustomerDetailViewModel(
      makeCustomer({
        preferred_staff_ids: ['h-1', 'h-2'],
        allowed_staff_ids: ['h-2'],
      }),
      helpers, emptyCustomers, emptyServiceTypes,
    );
    // h-1 は allowed に含まれないので preferredStaff に入る
    expect(vm.preferredStaff).toEqual([{ id: 'h-1', name: '鈴木 一郎', isPreferred: true }]);
    // h-2 は allowed に含まれるので preferredStaff には入らない
    expect(vm.preferredStaff.find((s) => s.id === 'h-2')).toBeUndefined();
    // h-2 は allowedStaff に入り isPreferred=true
    expect(vm.allowedStaff[0].isPreferred).toBe(true);
  });

  it('preferred のみの利用者で preferredStaff が設定される', () => {
    const helpers = new Map([
      ['h-1', makeHelper('h-1', '山本', 'さくら')],
    ]);
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ preferred_staff_ids: ['h-1'] }),
      helpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.preferredStaff).toEqual([{ id: 'h-1', name: '山本 さくら', isPreferred: true }]);
    expect(vm.allowedStaff).toEqual([]);
  });

  it('allowedStaff に preferred フラグが正しく設定される', () => {
    const helpers = new Map([
      ['h-1', makeHelper('h-1', '鈴木', '一郎')],
      ['h-2', makeHelper('h-2', '高橋', '二郎')],
    ]);
    const vm = buildCustomerDetailViewModel(
      makeCustomer({
        allowed_staff_ids: ['h-1', 'h-2'],
        preferred_staff_ids: ['h-2'],
      }),
      helpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.allowedStaff[0].isPreferred).toBe(false);
    expect(vm.allowedStaff[1].isPreferred).toBe(true);
  });

  it('同一世帯メンバーの名前解決（Map該当/非該当）', () => {
    const c2 = makeCustomer({ id: 'C002', name: { family: '佐藤', given: '次郎' } });
    const customersMap = new Map([['C002', c2]]);
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ same_household_customer_ids: ['C002', 'C003'] }),
      emptyHelpers, customersMap, emptyServiceTypes,
    );
    expect(vm.householdMembers).toEqual([
      { id: 'C002', name: '佐藤 次郎' },
      { id: 'C003', name: 'C003' },
    ]);
  });

  it('同一世帯に自己IDが含まれる場合はフィルタされる', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ id: 'cust-1', same_household_customer_ids: ['cust-1', 'C002'] }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.householdMembers.map((m) => m.id)).toEqual(['C002']);
  });

  it('同一施設メンバーの名前解決', () => {
    const c10 = makeCustomer({ id: 'C010', name: { family: '中村', given: '五郎' } });
    const customersMap = new Map([['C010', c10]]);
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ same_facility_customer_ids: ['C010'] }),
      emptyHelpers, customersMap, emptyServiceTypes,
    );
    expect(vm.facilityMembers).toEqual([{ id: 'C010', name: '中村 五郎' }]);
  });

  it('週間サービスのservice_typeがlabelに解決される', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({
        weekly_services: {
          monday: [{ start_time: '09:00', end_time: '10:00', service_type: 'physical_care', staff_count: 1 }],
        },
      }),
      emptyHelpers, emptyCustomers, sampleServiceTypes,
    );
    expect(vm.weeklyServices).toHaveLength(1);
    expect(vm.weeklyServices[0].dayLabel).toBe('月');
    expect(vm.weeklyServices[0].slots[0].serviceLabel).toBe('身体介護');
    expect(vm.weeklyServices[0].slots[0].time).toBe('09:00 - 10:00');
    expect(vm.weeklyServices.length).toBeGreaterThan(0);
  });

  it('未知のservice_typeはコードがそのまま使われる', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({
        weekly_services: {
          tuesday: [{ start_time: '10:00', end_time: '11:00', service_type: 'unknown_type', staff_count: 2 }],
        },
      }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.weeklyServices[0].slots[0].serviceLabel).toBe('unknown_type');
  });

  it('不定期パターンのtype labelが解決される', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({
        irregular_patterns: [{ type: 'biweekly', description: '第1・3週のみ', active_weeks: [1, 3] }],
      }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.irregularPatterns).toEqual([
      { typeLabel: '隔週', description: '第1・3週のみ', activeWeeks: [1, 3] },
    ]);
  });

  it('hasContact が連絡先フィールドの有無を反映する', () => {
    const vmNo = buildCustomerDetailViewModel(
      makeCustomer(), emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vmNo.hasContact).toBe(false);

    const vmYes = buildCustomerDetailViewModel(
      makeCustomer({ home_care_office: 'ケアセンター' }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vmYes.hasContact).toBe(true);
  });

  it('性別要件ラベルが正しく変換される', () => {
    const vm = buildCustomerDetailViewModel(
      makeCustomer({ gender_requirement: 'female' }),
      emptyHelpers, emptyCustomers, emptyServiceTypes,
    );
    expect(vm.genderRequirementLabel).toBe('女性のみ');
  });
});
