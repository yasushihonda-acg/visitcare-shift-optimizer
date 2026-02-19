import { resolve } from 'path';
import { parseCSV } from './utils/csv-parser.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface ValidationError {
  file: string;
  row?: number;
  field?: string;
  message: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_SERVICE_TYPES = ['physical_care', 'daily_living', 'mixed', 'prevention', 'private', 'disability', 'transport_support', 'severe_visiting'];
const VALID_CONSTRAINT_TYPES = ['ng', 'preferred'];
const VALID_TRANSPORT = ['car', 'bicycle', 'walk'];
const VALID_EMPLOYMENT = ['full_time', 'part_time'];

// 鹿児島市の座標範囲
const LAT_RANGE = { min: 31.5, max: 31.7 };
const LNG_RANGE = { min: 130.4, max: 130.7 };

export function validateAll(): ValidationError[] {
  const errors: ValidationError[] = [];

  errors.push(...validateCustomers());
  errors.push(...validateHelpers());
  errors.push(...validateServices());
  errors.push(...validateConstraints());
  errors.push(...validateAvailability());
  errors.push(...validateUnavailability());
  errors.push(...validateReferentialIntegrity());

  return errors;
}

export function validateCustomers(): ValidationError[] {
  const errors: ValidationError[] = [];
  const customers = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'customers.csv'));
  const ids = new Set<string>();

  customers.forEach((c, i) => {
    const row = i + 2; // CSV header + 0-indexed

    // 重複ID
    if (ids.has(c.id)) {
      errors.push({ file: 'customers.csv', row, field: 'id', message: `Duplicate ID: ${c.id}` });
    }
    ids.add(c.id);

    // 座標範囲
    const lat = parseFloat(c.lat);
    const lng = parseFloat(c.lng);
    if (isNaN(lat) || lat < LAT_RANGE.min || lat > LAT_RANGE.max) {
      errors.push({ file: 'customers.csv', row, field: 'lat', message: `Out of range: ${c.lat}` });
    }
    if (isNaN(lng) || lng < LNG_RANGE.min || lng > LNG_RANGE.max) {
      errors.push({ file: 'customers.csv', row, field: 'lng', message: `Out of range: ${c.lng}` });
    }

    // 必須フィールド
    if (!c.family_name || !c.given_name) {
      errors.push({ file: 'customers.csv', row, field: 'name', message: 'Missing name' });
    }
    if (!c.service_manager) {
      errors.push({ file: 'customers.csv', row, field: 'service_manager', message: 'Missing service_manager' });
    }
  });

  return errors;
}

export function validateHelpers(): ValidationError[] {
  const errors: ValidationError[] = [];
  const helpers = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'helpers.csv'));
  const ids = new Set<string>();

  helpers.forEach((h, i) => {
    const row = i + 2;

    if (ids.has(h.id)) {
      errors.push({ file: 'helpers.csv', row, field: 'id', message: `Duplicate ID: ${h.id}` });
    }
    ids.add(h.id);

    if (!VALID_TRANSPORT.includes(h.transportation)) {
      errors.push({ file: 'helpers.csv', row, field: 'transportation', message: `Invalid: ${h.transportation}` });
    }
    if (!VALID_EMPLOYMENT.includes(h.employment_type)) {
      errors.push({ file: 'helpers.csv', row, field: 'employment_type', message: `Invalid: ${h.employment_type}` });
    }
    if (!['true', 'false'].includes(h.can_physical_care)) {
      errors.push({ file: 'helpers.csv', row, field: 'can_physical_care', message: `Invalid boolean: ${h.can_physical_care}` });
    }
  });

  return errors;
}

export function validateServices(): ValidationError[] {
  const errors: ValidationError[] = [];
  const services = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'customer-services.csv'));

  services.forEach((s, i) => {
    const row = i + 2;

    if (!TIME_REGEX.test(s.start_time)) {
      errors.push({ file: 'customer-services.csv', row, field: 'start_time', message: `Invalid time: ${s.start_time}` });
    }
    if (!TIME_REGEX.test(s.end_time)) {
      errors.push({ file: 'customer-services.csv', row, field: 'end_time', message: `Invalid time: ${s.end_time}` });
    }
    if (TIME_REGEX.test(s.start_time) && TIME_REGEX.test(s.end_time) && s.start_time >= s.end_time) {
      errors.push({ file: 'customer-services.csv', row, message: `end_time (${s.end_time}) must be after start_time (${s.start_time})` });
    }
    if (!VALID_DAYS.includes(s.day_of_week)) {
      errors.push({ file: 'customer-services.csv', row, field: 'day_of_week', message: `Invalid day: ${s.day_of_week}` });
    }
    if (!VALID_SERVICE_TYPES.includes(s.service_type)) {
      errors.push({ file: 'customer-services.csv', row, field: 'service_type', message: `Invalid type: ${s.service_type}` });
    }
  });

  return errors;
}

export function validateConstraints(): ValidationError[] {
  const errors: ValidationError[] = [];
  const constraints = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'customer-staff-constraints.csv'));

  constraints.forEach((c, i) => {
    const row = i + 2;

    if (!VALID_CONSTRAINT_TYPES.includes(c.constraint_type)) {
      errors.push({ file: 'customer-staff-constraints.csv', row, field: 'constraint_type', message: `Invalid: ${c.constraint_type}` });
    }
  });

  return errors;
}

export function validateAvailability(): ValidationError[] {
  const errors: ValidationError[] = [];
  const availability = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'helper-availability.csv'));

  availability.forEach((a, i) => {
    const row = i + 2;

    if (!TIME_REGEX.test(a.start_time)) {
      errors.push({ file: 'helper-availability.csv', row, field: 'start_time', message: `Invalid time: ${a.start_time}` });
    }
    if (!TIME_REGEX.test(a.end_time)) {
      errors.push({ file: 'helper-availability.csv', row, field: 'end_time', message: `Invalid time: ${a.end_time}` });
    }
    if (!VALID_DAYS.includes(a.day_of_week)) {
      errors.push({ file: 'helper-availability.csv', row, field: 'day_of_week', message: `Invalid day: ${a.day_of_week}` });
    }
  });

  return errors;
}

export function validateUnavailability(): ValidationError[] {
  const errors: ValidationError[] = [];
  const unavailability = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'staff-unavailability.csv'));

  unavailability.forEach((u, i) => {
    const row = i + 2;

    if (u.all_day === 'false') {
      if (!TIME_REGEX.test(u.start_time)) {
        errors.push({ file: 'staff-unavailability.csv', row, field: 'start_time', message: `Required when all_day=false: ${u.start_time}` });
      }
      if (!TIME_REGEX.test(u.end_time)) {
        errors.push({ file: 'staff-unavailability.csv', row, field: 'end_time', message: `Required when all_day=false: ${u.end_time}` });
      }
    }
  });

  return errors;
}

export function validateReferentialIntegrity(): ValidationError[] {
  const errors: ValidationError[] = [];

  const customers = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'customers.csv'));
  const helpers = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'helpers.csv'));
  const services = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'customer-services.csv'));
  const constraints = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'customer-staff-constraints.csv'));
  const availability = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'helper-availability.csv'));
  const unavailability = parseCSV<Record<string, string>>(resolve(DATA_DIR, 'staff-unavailability.csv'));

  const customerIds = new Set(customers.map((c) => c.id));
  const helperIds = new Set(helpers.map((h) => h.id));

  // customer-services → customers
  services.forEach((s, i) => {
    if (!customerIds.has(s.customer_id)) {
      errors.push({ file: 'customer-services.csv', row: i + 2, message: `customer_id ${s.customer_id} not found in customers.csv` });
    }
  });

  // constraints → customers + helpers
  constraints.forEach((c, i) => {
    if (!customerIds.has(c.customer_id)) {
      errors.push({ file: 'customer-staff-constraints.csv', row: i + 2, message: `customer_id ${c.customer_id} not found` });
    }
    if (!helperIds.has(c.staff_id)) {
      errors.push({ file: 'customer-staff-constraints.csv', row: i + 2, message: `staff_id ${c.staff_id} not found in helpers.csv` });
    }
  });

  // availability → helpers
  availability.forEach((a, i) => {
    if (!helperIds.has(a.helper_id)) {
      errors.push({ file: 'helper-availability.csv', row: i + 2, message: `helper_id ${a.helper_id} not found in helpers.csv` });
    }
  });

  // unavailability → helpers
  unavailability.forEach((u, i) => {
    if (!helperIds.has(u.staff_id)) {
      errors.push({ file: 'staff-unavailability.csv', row: i + 2, message: `staff_id ${u.staff_id} not found in helpers.csv` });
    }
  });

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateAll();
  if (errors.length === 0) {
    console.log('✅ All validations passed');
  } else {
    console.error(`❌ ${errors.length} validation error(s) found:`);
    for (const e of errors) {
      console.error(`  ${e.file}${e.row ? `:${e.row}` : ''} ${e.field ? `[${e.field}]` : ''} ${e.message}`);
    }
    process.exit(1);
  }
}
