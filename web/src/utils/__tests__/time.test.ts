import { describe, it, expect } from 'vitest';
import { timeToMinutes } from '../time';

describe('timeToMinutes', () => {
  it('0:00 → 0', () => {
    expect(timeToMinutes('0:00')).toBe(0);
  });

  it('09:30 → 570', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });

  it('12:00 → 720', () => {
    expect(timeToMinutes('12:00')).toBe(720);
  });

  it('23:59 → 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});
