import { z } from 'zod';
import { detectOverlaps } from './timeOverlap';

const timeStringSchema = z.string().regex(/^\d{2}:\d{2}$/, '時刻はHH:MM形式で入力してください');

const personNameSchema = z.object({
  family: z.string().min(1, '姓は必須です'),
  given: z.string().min(1, '名は必須です'),
  short: z.string().optional(),
});

const geoLocationSchema = z.object({
  lat: z.number({ error: '緯度は必須です' }).min(-90).max(90),
  lng: z.number({ error: '経度は必須です' }).min(-180).max(180),
});

const serviceSlotSchema = z.object({
  start_time: timeStringSchema,
  end_time: timeStringSchema,
  service_type: z.enum([
    'physical_care', 'daily_living', 'mixed', 'prevention',
    'private', 'disability', 'transport_support', 'severe_visiting',
  ], {
    error: 'サービス種別は必須です',
  }),
  staff_count: z.number().int().min(1, '必要人数は1以上です').max(3),
});

const availabilitySlotSchema = z.object({
  start_time: timeStringSchema,
  end_time: timeStringSchema,
});

// Partial<Record<DayOfWeek, ServiceSlot[]>> を表現（同一曜日内の時間帯重複チェック付き）
const weeklyServicesSchema = z.record(z.string(), z.array(serviceSlotSchema)).superRefine(
  (weeklyServices, ctx) => {
    for (const [day, slots] of Object.entries(weeklyServices)) {
      if (!slots || slots.length < 2) continue;
      const overlaps = detectOverlaps(slots);
      if (overlaps.size > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [day],
          message: `時間帯が重複しているスロットがあります（スロット: ${[...overlaps].map((i) => i + 1).join(', ')}番目）`,
        });
      }
    }
  }
);

const weeklyAvailabilitySchema = z.record(z.string(), z.array(availabilitySlotSchema));

// ---- IrregularPattern ----
const irregularPatternSchema = z.object({
  type: z.enum(['biweekly', 'monthly', 'temporary_stop']),
  description: z.string().min(1, '説明は必須です'),
  active_weeks: z.array(z.number().int().min(0).max(3)).optional(),
});

// ---- Customer ----
export const customerSchema = z.object({
  name: personNameSchema,
  address: z.string().min(1, '住所は必須です'),
  location: geoLocationSchema,
  ng_staff_ids: z.array(z.string()),
  preferred_staff_ids: z.array(z.string()),
  weekly_services: weeklyServicesSchema,
  household_id: z.string().optional(),
  service_manager: z.string().min(1, 'サービス提供責任者は必須です'),
  gender_requirement: z.enum(['any', 'female', 'male']).optional(),
  notes: z.string().optional(),
  irregular_patterns: z.array(irregularPatternSchema).optional(),
  kaiso_id: z.string().optional(),
  karakara_id: z.string().optional(),
  cura_id: z.string().optional(),
  aozora_id: z.string().optional(),
  phone_number: z.string().optional(),
  home_care_office: z.string().optional(),
  consultation_support_office: z.string().optional(),
  care_manager_name: z.string().optional(),
  support_specialist_name: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

// ---- Helper ----
const trainingStatusSchema = z.record(
  z.string(),
  z.enum(['training', 'independent']),
);

export const helperSchema = z.object({
  name: personNameSchema,
  qualifications: z.array(z.string()),
  can_physical_care: z.boolean(),
  gender: z.enum(['male', 'female']),
  transportation: z.enum(['car', 'bicycle', 'walk']),
  weekly_availability: weeklyAvailabilitySchema,
  preferred_hours: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }),
  available_hours: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }),
  employment_type: z.enum(['full_time', 'part_time']),
  customer_training_status: trainingStatusSchema.optional(),
  split_shift_allowed: z.boolean().optional(),
  employee_number: z.string().optional(),
  address: z.string().optional(),
  location: geoLocationSchema.optional(),
  phone_number: z.string().optional(),
});

export type HelperFormValues = z.infer<typeof helperSchema>;

// ---- StaffUnavailability ----
const unavailableSlotSchema = z.object({
  date: z.string().min(1, '日付は必須です'),
  all_day: z.boolean(),
  start_time: z.union([timeStringSchema, z.literal('')]).optional(),
  end_time: z.union([timeStringSchema, z.literal('')]).optional(),
});

export const unavailabilitySchema = z.object({
  staff_id: z.string().min(1, 'スタッフは必須です'),
  week_start_date: z.string().min(1, '週の開始日は必須です'),
  unavailable_slots: z.array(unavailableSlotSchema).min(1, '不在スロットは1件以上必要です'),
  notes: z.string().optional(),
});

export type UnavailabilityFormValues = z.infer<typeof unavailabilitySchema>;
