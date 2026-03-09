/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// --- aggregation モック ---

const mockStaffSummary = [{ helperId: 'H001', name: '田中', visitCount: 5, totalMinutes: 300 }];
const mockCustomerSummary = [{ customerId: 'C001', name: '鈴木', visitCount: 3, totalMinutes: 180 }];
const mockStatusSummary = { pending: 1, assigned: 2, completed: 3, cancelled: 0, total: 6, completionRate: 0.5 };
const mockServiceTypeSummary = [{ serviceType: 'physical_care', label: '身体介護', count: 3 }];

vi.mock('@/lib/report/aggregation', () => ({
  aggregateStaffSummary: vi.fn(() => mockStaffSummary),
  aggregateCustomerSummary: vi.fn(() => mockCustomerSummary),
  aggregateStatusSummary: vi.fn(() => mockStatusSummary),
  aggregateServiceTypeSummary: vi.fn(() => mockServiceTypeSummary),
}));

import { useMonthlyReport } from '../useMonthlyReport';
import {
  aggregateStaffSummary,
  aggregateCustomerSummary,
  aggregateStatusSummary,
  aggregateServiceTypeSummary,
} from '@/lib/report/aggregation';

describe('useMonthlyReport', () => {
  const orders = [{ id: 'O001' }] as any[];
  const helpers = new Map() as any;
  const customers = new Map() as any;
  const serviceTypes = new Map() as any;

  it('各集計関数の結果を返す', () => {
    const { result } = renderHook(() => useMonthlyReport(orders, helpers, customers, serviceTypes));

    expect(result.current.staffSummary).toBe(mockStaffSummary);
    expect(result.current.customerSummary).toBe(mockCustomerSummary);
    expect(result.current.statusSummary).toBe(mockStatusSummary);
    expect(result.current.serviceTypeSummary).toBe(mockServiceTypeSummary);
  });

  it('aggregateStaffSummaryにorders, helpersが渡される', () => {
    renderHook(() => useMonthlyReport(orders, helpers, customers, serviceTypes));
    expect(aggregateStaffSummary).toHaveBeenCalledWith(orders, helpers);
  });

  it('aggregateCustomerSummaryにorders, customersが渡される', () => {
    renderHook(() => useMonthlyReport(orders, helpers, customers, serviceTypes));
    expect(aggregateCustomerSummary).toHaveBeenCalledWith(orders, customers);
  });

  it('aggregateStatusSummaryにordersが渡される', () => {
    renderHook(() => useMonthlyReport(orders, helpers, customers, serviceTypes));
    expect(aggregateStatusSummary).toHaveBeenCalledWith(orders);
  });

  it('aggregateServiceTypeSummaryにorders, serviceTypesが渡される', () => {
    renderHook(() => useMonthlyReport(orders, helpers, customers, serviceTypes));
    expect(aggregateServiceTypeSummary).toHaveBeenCalledWith(orders, serviceTypes);
  });
});
