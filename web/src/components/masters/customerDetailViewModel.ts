import { useMemo } from 'react';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS } from '@/types';
import type { Customer, Helper, ServiceTypeDoc, DayOfWeek } from '@/types';

// ── 表示ラベル定数 ──────────────────────────────────────────
const GENDER_REQUIREMENT_LABELS: Record<string, string> = {
  any: '指定なし',
  female: '女性のみ',
  male: '男性のみ',
};

const IRREGULAR_PATTERN_LABELS: Record<string, string> = {
  biweekly: '隔週',
  monthly: '月次',
  temporary_stop: '一時停止',
};

// ── ViewModel型定義 ─────────────────────────────────────────

export interface ResolvedStaff {
  id: string;
  name: string;
  isPreferred: boolean;
}

export interface WeeklyServiceRow {
  day: DayOfWeek;
  dayLabel: string;
  slots: {
    time: string;
    serviceLabel: string;
    staffCount: number;
  }[];
}

export interface IrregularPatternRow {
  typeLabel: string;
  description: string;
  activeWeeks?: number[];
}

export interface CustomerDetailViewModel {
  id: string;
  fullName: string;
  fullKana: string | null;
  shortName?: string;
  address: string;
  serviceManager: string;
  phoneNumber?: string;
  phoneNumber2?: string;
  phoneNote?: string;
  genderRequirementLabel: string;

  ngStaff: ResolvedStaff[];
  allowedStaff: ResolvedStaff[];
  householdMembers: { id: string; name: string }[];
  facilityMembers: { id: string; name: string }[];

  weeklyServices: WeeklyServiceRow[];

  irregularPatterns: IrregularPatternRow[];

  homeCareOffice?: string;
  careManagerName?: string;
  consultationSupportOffice?: string;
  supportSpecialistName?: string;
  hasContact: boolean;

  notes?: string;
  aozoraId?: string;
  hasExternalIds: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ── ビルダー純粋関数 ────────────────────────────────────────

function resolveStaffName(id: string, helpers: Map<string, Helper>): string {
  const h = helpers.get(id);
  return h ? `${h.name.family} ${h.name.given}` : id;
}

function resolveCustomerName(id: string, customers: Map<string, Customer>): string {
  const c = customers.get(id);
  return c ? `${c.name.family} ${c.name.given}` : id;
}

export function buildCustomerDetailViewModel(
  customer: Customer,
  helpers: Map<string, Helper>,
  customers: Map<string, Customer>,
  serviceTypes: Map<string, ServiceTypeDoc>,
): CustomerDetailViewModel {
  const fullName = `${customer.name.family} ${customer.name.given}`;
  const fullKana =
    customer.name.family_kana || customer.name.given_kana
      ? `${customer.name.family_kana ?? ''} ${customer.name.given_kana ?? ''}`.trim()
      : null;

  const preferredSet = new Set(customer.preferred_staff_ids ?? []);

  const ngStaff: ResolvedStaff[] = (customer.ng_staff_ids ?? [])
    .filter((id) => helpers.has(id))
    .map((id) => ({
      id,
      name: resolveStaffName(id, helpers),
      isPreferred: false,
    }));

  const allowedStaff: ResolvedStaff[] = (customer.allowed_staff_ids ?? [])
    .filter((id) => helpers.has(id))
    .map((id) => ({
      id,
      name: resolveStaffName(id, helpers),
      isPreferred: preferredSet.has(id),
    }));

  const householdMembers = (customer.same_household_customer_ids ?? [])
    .filter((id) => id !== customer.id)
    .map((id) => ({ id, name: resolveCustomerName(id, customers) }));

  const facilityMembers = (customer.same_facility_customer_ids ?? [])
    .filter((id) => id !== customer.id)
    .map((id) => ({ id, name: resolveCustomerName(id, customers) }));

  const weeklyServices: WeeklyServiceRow[] = DAY_OF_WEEK_ORDER
    .filter((day) => customer.weekly_services[day] && customer.weekly_services[day]!.length > 0)
    .map((day) => ({
      day,
      dayLabel: DAY_OF_WEEK_LABELS[day],
      slots: customer.weekly_services[day]!.map((slot) => ({
        time: `${slot.start_time} - ${slot.end_time}`,
        serviceLabel: serviceTypes.get(slot.service_type)?.label ?? slot.service_type,
        staffCount: slot.staff_count,
      })),
    }));

  const irregularPatterns: IrregularPatternRow[] = (customer.irregular_patterns ?? []).map((p) => ({
    typeLabel: IRREGULAR_PATTERN_LABELS[p.type] ?? p.type,
    description: p.description,
    activeWeeks: p.active_weeks,
  }));

  const hasContact = !!(
    customer.home_care_office ||
    customer.care_manager_name ||
    customer.consultation_support_office ||
    customer.support_specialist_name
  );

  return {
    id: customer.id,
    fullName,
    fullKana,
    shortName: customer.name.short,
    address: customer.address,
    serviceManager: customer.service_manager,
    phoneNumber: customer.phone_number,
    phoneNumber2: customer.phone_number2,
    phoneNote: customer.phone_note,
    genderRequirementLabel:
      GENDER_REQUIREMENT_LABELS[customer.gender_requirement ?? 'any'] ?? '指定なし',

    ngStaff,
    allowedStaff,
    householdMembers,
    facilityMembers,

    weeklyServices,

    irregularPatterns,

    homeCareOffice: customer.home_care_office,
    careManagerName: customer.care_manager_name,
    consultationSupportOffice: customer.consultation_support_office,
    supportSpecialistName: customer.support_specialist_name,
    hasContact,

    notes: customer.notes,
    aozoraId: customer.aozora_id,
    hasExternalIds: !!customer.aozora_id,

    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

// ── React Hook ──────────────────────────────────────────────

export function useCustomerDetailViewModel(
  customer: Customer | null,
  helpers: Map<string, Helper>,
  customers: Map<string, Customer>,
  serviceTypes: Map<string, ServiceTypeDoc>,
): CustomerDetailViewModel | null {
  return useMemo(
    () => customer ? buildCustomerDetailViewModel(customer, helpers, customers, serviceTypes) : null,
    [customer, helpers, customers, serviceTypes],
  );
}
