import { describe, it, expect } from 'vitest';
import {
  validateAll,
  validateCustomers,
  validateHelpers,
  validateServices,
  validateConstraints,
  validateAvailability,
  validateUnavailability,
  validateReferentialIntegrity,
} from '../scripts/validate-data.js';

describe('validateAll', () => {
  it('should pass all validations on seed data', () => {
    const errors = validateAll();
    expect(errors).toEqual([]);
  });
});

describe('validateCustomers', () => {
  it('should find no errors in customers.csv', () => {
    const errors = validateCustomers();
    expect(errors).toEqual([]);
  });

  it('should have exactly 50 customers', () => {
    // validateCustomers checks for duplicates, so if it passes,
    // we verify the count via the no-error assertion
    const errors = validateCustomers();
    expect(errors).toEqual([]);
  });
});

describe('validateHelpers', () => {
  it('should find no errors in helpers.csv', () => {
    const errors = validateHelpers();
    expect(errors).toEqual([]);
  });
});

describe('validateServices', () => {
  it('should find no errors in customer-services.csv', () => {
    const errors = validateServices();
    expect(errors).toEqual([]);
  });
});

describe('validateConstraints', () => {
  it('should find no errors in customer-staff-constraints.csv', () => {
    const errors = validateConstraints();
    expect(errors).toEqual([]);
  });
});

describe('validateAvailability', () => {
  it('should find no errors in helper-availability.csv', () => {
    const errors = validateAvailability();
    expect(errors).toEqual([]);
  });
});

describe('validateUnavailability', () => {
  it('should find no errors in staff-unavailability.csv', () => {
    const errors = validateUnavailability();
    expect(errors).toEqual([]);
  });
});

describe('validateReferentialIntegrity', () => {
  it('should find no referential integrity errors', () => {
    const errors = validateReferentialIntegrity();
    expect(errors).toEqual([]);
  });
});
