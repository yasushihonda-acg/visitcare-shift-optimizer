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
import type { Order, Helper, Customer, ServiceTypeDoc } from '@/types';

export interface MonthlyReportData {
  staffSummary: StaffSummaryRow[];
  customerSummary: CustomerSummaryRow[];
  statusSummary: StatusSummary;
  serviceTypeSummary: ServiceTypeSummaryItem[];
}

export function useMonthlyReport(
  orders: Order[],
  helpers: Map<string, Helper>,
  customers: Map<string, Customer>,
  serviceTypes?: Map<string, ServiceTypeDoc>
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
    () => aggregateServiceTypeSummary(orders, serviceTypes),
    [orders, serviceTypes]
  );

  return { staffSummary, customerSummary, statusSummary, serviceTypeSummary };
}
