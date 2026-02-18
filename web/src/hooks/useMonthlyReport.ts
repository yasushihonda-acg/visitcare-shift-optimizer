'use client';

import { useMemo } from 'react';
import {
  aggregateStaffSummary,
  aggregateCustomerSummary,
  aggregateStatusSummary,
  aggregateServiceTypeSummary,
  type StaffSummaryRow,
  type CustomerSummaryRow,
  type StatusSummary,
  type ServiceTypeSummaryItem,
} from '@/lib/report/aggregation';
import type { Order, Helper, Customer } from '@/types';

export interface MonthlyReportData {
  staffSummary: StaffSummaryRow[];
  customerSummary: CustomerSummaryRow[];
  statusSummary: StatusSummary;
  serviceTypeSummary: ServiceTypeSummaryItem[];
}

export function useMonthlyReport(
  orders: Order[],
  helpers: Map<string, Helper>,
  customers: Map<string, Customer>
): MonthlyReportData {
  const staffSummary = useMemo(
    () => aggregateStaffSummary(orders, helpers),
    [orders, helpers]
  );

  const customerSummary = useMemo(
    () => aggregateCustomerSummary(orders, customers),
    [orders, customers]
  );

  const statusSummary = useMemo(
    () => aggregateStatusSummary(orders),
    [orders]
  );

  const serviceTypeSummary = useMemo(
    () => aggregateServiceTypeSummary(orders),
    [orders]
  );

  return { staffSummary, customerSummary, statusSummary, serviceTypeSummary };
}
