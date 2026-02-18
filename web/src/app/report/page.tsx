'use client';

import { useState } from 'react';
import { startOfMonth } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { MonthSelector } from '@/components/report/MonthSelector';
import { StaffSummaryTable } from '@/components/report/StaffSummaryTable';
import { CustomerSummaryTable } from '@/components/report/CustomerSummaryTable';
import { StatusSummaryCard } from '@/components/report/StatusSummaryCard';
import { ServiceTypeSummaryCard } from '@/components/report/ServiceTypeSummaryCard';
import { useMonthlyOrders } from '@/hooks/useMonthlyOrders';
import { useMonthlyReport } from '@/hooks/useMonthlyReport';
import { useHelpers } from '@/hooks/useHelpers';
import { useCustomers } from '@/hooks/useCustomers';

export default function ReportPage() {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const { orders, loading: ordersLoading } = useMonthlyOrders(month);
  const { helpers, loading: helpersLoading } = useHelpers();
  const { customers, loading: customersLoading } = useCustomers();

  const loading = ordersLoading || helpersLoading || customersLoading;

  const { staffSummary, customerSummary, statusSummary, serviceTypeSummary } =
    useMonthlyReport(orders, helpers, customers);

  const totalMinutes = serviceTypeSummary.reduce((sum, item) => sum + item.totalMinutes, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* ヘッダー行 */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">月次レポート</h1>
            <MonthSelector month={month} onChange={setMonth} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <StatusSummaryCard summary={statusSummary} />
              <ServiceTypeSummaryCard items={serviceTypeSummary} totalMinutes={totalMinutes} />
              <StaffSummaryTable rows={staffSummary} />
              <CustomerSummaryTable rows={customerSummary} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
