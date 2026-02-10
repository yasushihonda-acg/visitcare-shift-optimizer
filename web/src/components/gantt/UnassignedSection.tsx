'use client';

import { Badge } from '@/components/ui/badge';
import type { Order, Customer } from '@/types';

interface UnassignedSectionProps {
  orders: Order[];
  customers: Map<string, Customer>;
  onOrderClick?: (order: Order) => void;
}

const SERVICE_LABELS: Record<string, string> = {
  physical_care: '身体',
  daily_living: '生活',
};

export function UnassignedSection({ orders, customers, onOrderClick }: UnassignedSectionProps) {
  return (
    <div className="mt-4 border rounded-lg p-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        未割当 ({orders.length}件)
      </h3>
      <div className="flex flex-wrap gap-2">
        {orders.map((order) => {
          const customer = customers.get(order.customer_id);
          const name = customer
            ? (customer.name.short ?? `${customer.name.family}${customer.name.given}`)
            : order.customer_id;

          return (
            <button
              key={order.id}
              onClick={() => onOrderClick?.(order)}
              className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs hover:bg-muted transition-colors"
            >
              <Badge variant="outline" className="text-[10px]">
                {SERVICE_LABELS[order.service_type] ?? order.service_type}
              </Badge>
              <span>{name}</span>
              <span className="text-muted-foreground">
                {order.start_time}-{order.end_time}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
