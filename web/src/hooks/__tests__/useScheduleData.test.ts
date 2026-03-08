import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// --- モック定義 ---

const mockHelpers = new Map();
const mockCustomers = new Map();

vi.mock('../useHelpers', () => ({
  useHelpers: vi.fn(() => ({ helpers: mockHelpers, loading: false, error: null })),
}));
vi.mock('../useCustomers', () => ({
  useCustomers: vi.fn(() => ({ customers: mockCustomers, loading: false, error: null })),
}));
vi.mock('../useOrders', () => ({
  useOrders: vi.fn(() => ({ orders: [], loading: false, error: null })),
}));
vi.mock('../useStaffUnavailability', () => ({
  useStaffUnavailability: vi.fn(() => ({ unavailability: [], loading: false, error: null })),
}));
vi.mock('../useTravelTimes', () => ({
  useTravelTimes: vi.fn(() => ({ travelTimeLookup: new Map(), loading: false, error: null })),
}));

import { useScheduleData } from '../useScheduleData';
import { useHelpers } from '../useHelpers';
import { useCustomers } from '../useCustomers';
import { useOrders } from '../useOrders';
import { useStaffUnavailability } from '../useStaffUnavailability';
import { useTravelTimes } from '../useTravelTimes';

const weekStart = new Date('2025-01-06');

describe('useScheduleData loading', () => {
  it('全hookロード完了 → loading=false', () => {
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(false);
  });

  it('helpersLoading=true → loading=true', () => {
    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useHelpers).mockReturnValue({ helpers: mockHelpers, loading: false, error: null });
  });

  it('customersLoading=true → loading=true', () => {
    vi.mocked(useCustomers).mockReturnValue({ customers: mockCustomers, loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useCustomers).mockReturnValue({ customers: mockCustomers, loading: false, error: null });
  });

  it('ordersLoading=true → loading=true', () => {
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useOrders).mockReturnValue({ orders: [], loading: false, error: null });
  });

  it('unavailabilityLoading=true → loading=true', () => {
    vi.mocked(useStaffUnavailability).mockReturnValue({ unavailability: [], loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useStaffUnavailability).mockReturnValue({ unavailability: [], loading: false, error: null });
  });

  it('travelTimesLoading=true → loading=true', () => {
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: new Map(), loading: true, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.loading).toBe(true);
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: new Map(), loading: false, error: null });
  });

  it('travelTimeLookupが返される', () => {
    const lookup = new Map([['C001_C002', 15]]);
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: lookup, loading: false, error: null });
    const { result } = renderHook(() => useScheduleData(weekStart));
    expect(result.current.travelTimeLookup).toBe(lookup);
    vi.mocked(useTravelTimes).mockReturnValue({ travelTimeLookup: new Map(), loading: false, error: null });
  });
});
