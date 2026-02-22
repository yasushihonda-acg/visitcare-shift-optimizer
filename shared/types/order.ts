import { Timestamp } from 'firebase-admin/firestore';
import { OrderStatus, ServiceType, TimeString } from './common';

/** オーダー（個別サービス依頼） */
export interface Order {
  id: string;
  customer_id: string;
  week_start_date: Timestamp;
  date: Timestamp;
  start_time: TimeString;
  end_time: TimeString;
  service_type: ServiceType;
  assigned_staff_ids: string[];
  staff_count?: number;
  status: OrderStatus;
  linked_order_id?: string;
  manually_edited: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}
