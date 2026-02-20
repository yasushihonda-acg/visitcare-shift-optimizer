import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

const PROJECT_ID = 'demo-visitcare-rules-test';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** テストデータをルールバイパスでセットアップ */
async function setupTestData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'customers', 'customer-1'), {
      name: '田中太郎',
      address: '東京都新宿区',
    });
    await setDoc(doc(db, 'helpers', 'helper-1'), {
      name: '佐藤花子',
      qualifications: ['身体介護'],
    });
    await setDoc(doc(db, 'orders', 'order-1'), {
      customer_id: 'customer-1',
      assigned_staff_ids: ['helper-1'],
      manually_edited: false,
      service_type: 'physical_care',
      start_time: '2026-02-16T09:00:00+09:00',
      end_time: '2026-02-16T10:00:00+09:00',
      updated_at: new Date(),
    });
    await setDoc(doc(db, 'service_types', 'physical_care'), {
      code: 'physical_care',
      label: '身体介護',
      short_label: '身体',
      requires_physical_care_cert: true,
      sort_order: 1,
    });
    await setDoc(doc(db, 'travel_times', 'tt-1'), {
      from: 'customer-1',
      to: 'customer-2',
      duration_minutes: 15,
    });
    await setDoc(doc(db, 'staff_unavailability', 'su-1'), {
      helper_id: 'helper-1',
      date: '2026-02-17',
      reason: '希望休',
    });
  });
}

// ============================================================
// 未認証ユーザー: 全コレクション読み取り不可
// ============================================================
describe('未認証ユーザー', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('customers を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'customers', 'customer-1')));
  });

  it('helpers を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'helpers', 'helper-1')));
  });

  it('orders を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'orders', 'order-1')));
  });

  it('travel_times を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'travel_times', 'tt-1')));
  });

  it('staff_unavailability を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'staff_unavailability', 'su-1')));
  });

  it('service_types を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'service_types', 'physical_care')));
  });
});

// ============================================================
// 認証済みユーザー: 全コレクション読み取り可
// ============================================================
describe('認証済みユーザー - 読み取り', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('customers を読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'customers', 'customer-1')));
  });

  it('helpers を読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'helpers', 'helper-1')));
  });

  it('orders を読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'orders', 'order-1')));
  });

  it('travel_times を読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'travel_times', 'tt-1')));
  });

  it('staff_unavailability を読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'staff_unavailability', 'su-1')));
  });

  it('service_types を読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'service_types', 'physical_care')));
  });
});

// ============================================================
// 認証済みユーザー: マスタコレクション書き込み（customers/helpers以外は拒否）
// ============================================================
describe('認証済みユーザー - マスタコレクション書き込み', () => {
  it('travel_times に書き込めない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'travel_times', 'tt-new'), { from: 'a', to: 'b' })
    );
  });

});

// ============================================================
// staff_unavailability: create/update/delete 許可（isValidUnavailability バリデーション）
// ============================================================
/** isValidUnavailability を満たす有効なデータ */
const validUnavailabilityData = {
  staff_id: 'helper-1',
  week_start_date: new Date('2026-02-16T00:00:00+09:00'),
  unavailable_slots: [
    { date: new Date('2026-02-17T00:00:00+09:00'), all_day: true },
  ],
  notes: '家族行事のため',
  submitted_at: serverTimestamp(),
};

describe('認証済みユーザー - staff_unavailability create', () => {
  it('有効なデータで新規作成できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-new'), validUnavailabilityData)
    );
  });

  it('staff_id がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    const { staff_id: _, ...noStaffId } = validUnavailabilityData;
    await assertFails(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-bad'), noStaffId)
    );
  });

  it('week_start_date がtimestampでない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-bad'), {
        ...validUnavailabilityData,
        week_start_date: '2026-02-16',
      })
    );
  });

  it('unavailable_slots が配列でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-bad'), {
        ...validUnavailabilityData,
        unavailable_slots: 'not-an-array',
      })
    );
  });
});

describe('認証済みユーザー - staff_unavailability update', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'staff_unavailability', 'su-existing'), validUnavailabilityData);
    });
  });

  it('有効なデータで更新できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-existing'), {
        ...validUnavailabilityData,
        notes: '通院のため',
      })
    );
  });

  it('必須フィールドを欠いた更新は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-existing'), {
        notes: '通院のため',
      })
    );
  });
});

describe('認証済みユーザー - staff_unavailability delete', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'staff_unavailability', 'su-to-delete'), validUnavailabilityData);
    });
  });

  it('希望休を削除できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      deleteDoc(doc(authed.firestore(), 'staff_unavailability', 'su-to-delete'))
    );
  });
});

describe('未認証ユーザー - staff_unavailability write', () => {
  it('未認証ユーザーはstaff_unavailabilityに書き込めない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(unauthed.firestore(), 'staff_unavailability', 'su-unauth'), validUnavailabilityData)
    );
  });
});

// ============================================================
// customers: create/update 許可（isValidCustomer バリデーション）
// ============================================================
/** isValidCustomer を満たす有効なcustomerデータ */
const validCustomerData = {
  name: { family: '田中', given: '太郎' },
  address: '東京都新宿区1-1-1',
  location: { lat: 35.6895, lng: 139.6917 },
  ng_staff_ids: [],
  preferred_staff_ids: [],
  weekly_services: {},
  service_manager: '鈴木花子',
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
};

describe('認証済みユーザー - customers create', () => {
  it('有効なデータで新規作成できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'customers', 'customer-new'), validCustomerData)
    );
  });

  it('name.family がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'customers', 'customer-bad'), {
        ...validCustomerData,
        name: { given: '太郎' },
      })
    );
  });

  it('location がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    const { location: _, ...noLocation } = validCustomerData;
    await assertFails(
      setDoc(doc(authed.firestore(), 'customers', 'customer-bad'), noLocation)
    );
  });

  it('ng_staff_ids が配列でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'customers', 'customer-bad'), {
        ...validCustomerData,
        ng_staff_ids: 'not-an-array',
      })
    );
  });

  it('service_manager がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    const { service_manager: _, ...noSM } = validCustomerData;
    await assertFails(
      setDoc(doc(authed.firestore(), 'customers', 'customer-bad'), noSM)
    );
  });
});

describe('認証済みユーザー - customers update', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'customers', 'customer-existing'), validCustomerData);
    });
  });

  it('有効なデータで更新できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'customers', 'customer-existing'), {
        ...validCustomerData,
        address: '東京都渋谷区2-2-2',
        notes: '住所変更',
      })
    );
  });

  it('必須フィールドを欠いた更新は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'customers', 'customer-existing'), {
        name: { family: '田中', given: '太郎' },
      })
    );
  });
});

describe('認証済みユーザー - customers delete', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'customers', 'customer-to-delete'), validCustomerData);
    });
  });

  it('customers を削除できない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(deleteDoc(doc(authed.firestore(), 'customers', 'customer-to-delete')));
  });
});

describe('未認証ユーザー - customers write', () => {
  it('未認証ユーザーはcustomersに書き込めない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(unauthed.firestore(), 'customers', 'customer-unauth'), validCustomerData)
    );
  });
});

// ============================================================
// helpers: create/update 許可（isValidHelper バリデーション）
// ============================================================
/** isValidHelper を満たす有効なhelperデータ */
const validHelperData = {
  name: { family: '佐藤', given: '花子' },
  qualifications: ['介護福祉士'],
  can_physical_care: true,
  transportation: 'car',
  weekly_availability: {},
  preferred_hours: { min: 20, max: 40 },
  available_hours: { min: 10, max: 40 },
  employment_type: 'full_time',
  customer_training_status: {},
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
};

describe('認証済みユーザー - helpers create', () => {
  it('有効なデータで新規作成できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-new'), validHelperData)
    );
  });

  it('name.family がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-bad'), {
        ...validHelperData,
        name: { given: '花子' },
      })
    );
  });

  it('qualifications が配列でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-bad'), {
        ...validHelperData,
        qualifications: 'not-an-array',
      })
    );
  });

  it('can_physical_care が真偽値でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-bad'), {
        ...validHelperData,
        can_physical_care: 'yes',
      })
    );
  });

  it('preferred_hours がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    const { preferred_hours: _, ...noPreferredHours } = validHelperData;
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-bad'), noPreferredHours)
    );
  });

  it('employment_type がない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    const { employment_type: _, ...noEmploymentType } = validHelperData;
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-bad'), noEmploymentType)
    );
  });
});

describe('認証済みユーザー - helpers update', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'helpers', 'helper-existing'), validHelperData);
    });
  });

  it('有効なデータで更新できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-existing'), {
        ...validHelperData,
        transportation: 'bicycle',
      })
    );
  });

  it('必須フィールドを欠いた更新は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-existing'), {
        name: { family: '佐藤', given: '花子' },
      })
    );
  });
});

describe('認証済みユーザー - helpers delete', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'helpers', 'helper-to-delete'), validHelperData);
    });
  });

  it('helpers を削除できない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(deleteDoc(doc(authed.firestore(), 'helpers', 'helper-to-delete')));
  });
});

describe('未認証ユーザー - helpers write', () => {
  it('未認証ユーザーはhelpersに書き込めない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(unauthed.firestore(), 'helpers', 'helper-unauth'), validHelperData)
    );
  });
});

// ============================================================
// orders: 許可フィールドのみ update 可
// ============================================================
describe('認証済みユーザー - orders update', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('許可フィールド (assigned_staff_ids, manually_edited, updated_at) のみ更新できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-2'],
        manually_edited: true,
        updated_at: serverTimestamp(),
      })
    );
  });

  it('start_time, end_time を含む更新ができる（D&D時間軸移動）', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-2'],
        start_time: '2026-02-16T10:00:00+09:00',
        end_time: '2026-02-16T11:00:00+09:00',
        manually_edited: true,
        updated_at: serverTimestamp(),
      })
    );
  });

  it('不許可フィールド (service_type) を含む更新は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-1'), {
        service_type: 'daily_living',
      })
    );
  });

  it('不許可フィールド (customer_id) を含む更新は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-2'],
        customer_id: 'customer-999',
      })
    );
  });
});

// ============================================================
// orders: create / delete 不可
// ============================================================
describe('認証済みユーザー - orders create/delete', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('orders を新規作成できない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'orders', 'order-new'), {
        customer_id: 'customer-1',
        assigned_staff_ids: [],
        service_type: 'physical_care',
      })
    );
  });

  it('orders を削除できない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(deleteDoc(doc(authed.firestore(), 'orders', 'order-1')));
  });
});

// ============================================================
// orders: 型バリデーション
// ============================================================
describe('認証済みユーザー - orders 型バリデーション', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('assigned_staff_ids が配列でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: 'not-an-array',
        manually_edited: true,
        updated_at: serverTimestamp(),
      })
    );
  });

  it('manually_edited が真偽値でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-1'],
        manually_edited: 'yes',
        updated_at: serverTimestamp(),
      })
    );
  });
});

// ============================================================
// orders: status 遷移バリデーション
// ============================================================
describe('認証済みユーザー - orders status 遷移', () => {
  async function setupOrderWithStatus(status: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'orders', 'order-status'), {
        customer_id: 'customer-1',
        assigned_staff_ids: ['helper-1'],
        manually_edited: false,
        service_type: 'physical_care',
        start_time: '09:00',
        end_time: '10:00',
        status,
        updated_at: new Date(),
      });
    });
  }

  it('assigned → completed の遷移が許可される', async () => {
    await setupOrderWithStatus('assigned');
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'completed',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('assigned → cancelled の遷移が許可される', async () => {
    await setupOrderWithStatus('assigned');
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('pending → cancelled の遷移が許可される', async () => {
    await setupOrderWithStatus('pending');
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('pending → completed の遷移は拒否される', async () => {
    await setupOrderWithStatus('pending');
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'completed',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('completed → assigned の遷移は拒否される（最終状態）', async () => {
    await setupOrderWithStatus('completed');
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'assigned',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('cancelled → assigned の遷移は拒否される（最終状態）', async () => {
    await setupOrderWithStatus('cancelled');
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'assigned',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('不正な status 値は拒否される', async () => {
    await setupOrderWithStatus('assigned');
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'invalid_status',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('assigned → assigned の同一ステータス送信は許可される（実質ノーオペレーション）', async () => {
    // NOTE: Firestore Security Rules の diff().affectedKeys() は同一値フィールドを検出しない。
    // そのため、同一ステータスの送信はルールレベルでは拒否できず、実質的なノーオペレーション
    // （データは変わらない）として扱われる。同一ステータス遷移の防止はアプリ層で行うこと。
    await setupOrderWithStatus('assigned');
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'assigned',
        updated_at: serverTimestamp(),
      })
    );
  });

  it('status と他の許可フィールドを同時に更新できる', async () => {
    await setupOrderWithStatus('assigned');
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      updateDoc(doc(authed.firestore(), 'orders', 'order-status'), {
        status: 'completed',
        assigned_staff_ids: ['helper-1'],
        manually_edited: false,
        updated_at: serverTimestamp(),
      })
    );
  });
});

// ============================================================
// RBAC: admin ロール
// ============================================================
describe('RBAC: admin ロール', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('customers を作成できる', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), 'customers', 'customer-new'), validCustomerData)
    );
  });

  it('helpers を作成できる', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), 'helpers', 'helper-new'), validHelperData)
    );
  });

  it('orders を更新できる', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-2'],
        manually_edited: true,
        updated_at: serverTimestamp(),
      })
    );
  });

  it('staff_unavailability を作成できる', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), 'staff_unavailability', 'su-admin'), validUnavailabilityData)
    );
  });

  it('staff_unavailability を削除できる', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'staff_unavailability', 'su-del'), validUnavailabilityData);
    });
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(
      deleteDoc(doc(admin.firestore(), 'staff_unavailability', 'su-del'))
    );
  });
});

// ============================================================
// RBAC: service_manager ロール
// ============================================================
describe('RBAC: service_manager ロール', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('customers を作成できる', async () => {
    const manager = testEnv.authenticatedContext('manager-1', { role: 'service_manager' });
    await assertSucceeds(
      setDoc(doc(manager.firestore(), 'customers', 'customer-new'), validCustomerData)
    );
  });

  it('helpers を作成できない', async () => {
    const manager = testEnv.authenticatedContext('manager-1', { role: 'service_manager' });
    await assertFails(
      setDoc(doc(manager.firestore(), 'helpers', 'helper-new'), validHelperData)
    );
  });

  it('orders を更新できる', async () => {
    const manager = testEnv.authenticatedContext('manager-1', { role: 'service_manager' });
    await assertSucceeds(
      updateDoc(doc(manager.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-2'],
        manually_edited: true,
        updated_at: serverTimestamp(),
      })
    );
  });

  it('staff_unavailability を作成できる', async () => {
    const manager = testEnv.authenticatedContext('manager-1', { role: 'service_manager' });
    await assertSucceeds(
      setDoc(doc(manager.firestore(), 'staff_unavailability', 'su-mgr'), validUnavailabilityData)
    );
  });
});

// ============================================================
// RBAC: helper ロール
// ============================================================
describe('RBAC: helper ロール', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('全コレクションを読み取れる', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertSucceeds(getDoc(doc(helper.firestore(), 'customers', 'customer-1')));
    await assertSucceeds(getDoc(doc(helper.firestore(), 'helpers', 'helper-1')));
    await assertSucceeds(getDoc(doc(helper.firestore(), 'orders', 'order-1')));
  });

  it('customers を作成できない', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(
      setDoc(doc(helper.firestore(), 'customers', 'customer-new'), validCustomerData)
    );
  });

  it('helpers を作成できない', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(
      setDoc(doc(helper.firestore(), 'helpers', 'helper-new'), validHelperData)
    );
  });

  it('orders を更新できない', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(
      updateDoc(doc(helper.firestore(), 'orders', 'order-1'), {
        assigned_staff_ids: ['helper-2'],
        manually_edited: true,
        updated_at: serverTimestamp(),
      })
    );
  });

  it('自分の希望休を作成できる', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertSucceeds(
      setDoc(doc(helper.firestore(), 'staff_unavailability', 'su-own'), {
        ...validUnavailabilityData,
        staff_id: 'helper-1',
      })
    );
  });

  it('他人の希望休を作成できない', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(
      setDoc(doc(helper.firestore(), 'staff_unavailability', 'su-other'), {
        ...validUnavailabilityData,
        staff_id: 'helper-999',
      })
    );
  });

  it('自分の希望休を削除できる', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'staff_unavailability', 'su-own-del'), {
        ...validUnavailabilityData,
        staff_id: 'helper-1',
      });
    });
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertSucceeds(
      deleteDoc(doc(helper.firestore(), 'staff_unavailability', 'su-own-del'))
    );
  });

  it('他人の希望休を削除できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'staff_unavailability', 'su-other-del'), {
        ...validUnavailabilityData,
        staff_id: 'helper-999',
      });
    });
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(
      deleteDoc(doc(helper.firestore(), 'staff_unavailability', 'su-other-del'))
    );
  });
});

// ============================================================
// optimization_runs: 読み取りのみ（Admin SDKで書き込み）
// ============================================================
describe('optimization_runs', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'optimization_runs', 'run-1'), {
        week_start_date: '2026-02-09',
        status: 'Optimal',
        objective_value: 42.5,
        total_orders: 160,
        assigned_count: 160,
      });
    });
  });

  it('未認証ユーザーは読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'optimization_runs', 'run-1')));
  });

  it('admin が読み取れる', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(getDoc(doc(admin.firestore(), 'optimization_runs', 'run-1')));
  });

  it('service_manager が読み取れる', async () => {
    const manager = testEnv.authenticatedContext('manager-1', { role: 'service_manager' });
    await assertSucceeds(getDoc(doc(manager.firestore(), 'optimization_runs', 'run-1')));
  });

  it('デモモード（role未設定）で読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'optimization_runs', 'run-1')));
  });

  it('helper ロールは読み取れない', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(getDoc(doc(helper.firestore(), 'optimization_runs', 'run-1')));
  });

  it('FEから書き込みできない', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertFails(
      setDoc(doc(admin.firestore(), 'optimization_runs', 'run-new'), {
        week_start_date: '2026-02-16',
        status: 'Optimal',
      })
    );
  });

  it('FEから削除できない', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertFails(deleteDoc(doc(admin.firestore(), 'optimization_runs', 'run-1')));
  });
});

// ============================================================
// service_types: isValidServiceType バリデーション + RBAC
// ============================================================
/** isValidServiceType を満たす有効なデータ */
const validServiceTypeData = {
  code: 'physical_care',
  label: '身体介護',
  short_label: '身体',
  requires_physical_care_cert: true,
  sort_order: 1,
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
};

describe('未認証ユーザー - service_types', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'service_types', 'physical_care'), validServiceTypeData);
    });
  });

  it('service_types を読み取れない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauthed.firestore(), 'service_types', 'physical_care')));
  });

  it('service_types に書き込めない', async () => {
    const unauthed = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(unauthed.firestore(), 'service_types', 'new_type'), validServiceTypeData)
    );
  });
});

describe('認証済みユーザー - service_types 読み取り', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'service_types', 'physical_care'), validServiceTypeData);
    });
  });

  it('認証済みユーザーは読み取れる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(getDoc(doc(authed.firestore(), 'service_types', 'physical_care')));
  });

  it('helper ロールでも読み取れる', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertSucceeds(getDoc(doc(helper.firestore(), 'service_types', 'physical_care')));
  });
});

describe('認証済みユーザー（デモモード）- service_types create', () => {
  it('有効なデータで新規作成できる', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertSucceeds(
      setDoc(doc(authed.firestore(), 'service_types', 'new_type'), {
        ...validServiceTypeData,
        code: 'new_type',
      })
    );
  });

  it('code が文字列でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'service_types', 'bad-type'), {
        ...validServiceTypeData,
        code: 123,
      })
    );
  });

  it('requires_physical_care_cert が真偽値でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'service_types', 'bad-type'), {
        ...validServiceTypeData,
        requires_physical_care_cert: 'yes',
      })
    );
  });

  it('sort_order が整数でない場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'service_types', 'bad-type'), {
        ...validServiceTypeData,
        sort_order: 1.5,
      })
    );
  });

  it('必須フィールドが欠けている場合は拒否される', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    const { label: _, ...noLabel } = validServiceTypeData;
    await assertFails(
      setDoc(doc(authed.firestore(), 'service_types', 'bad-type'), noLabel)
    );
  });
});

describe('admin ロール - service_types create/update', () => {
  it('admin は有効なデータで新規作成できる', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), 'service_types', 'admin_type'), {
        ...validServiceTypeData,
        code: 'admin_type',
      })
    );
  });
});

describe('helper ロール - service_types write', () => {
  it('helper ロールは service_types に書き込めない', async () => {
    const helper = testEnv.authenticatedContext('helper-uid', { role: 'helper', helper_id: 'helper-1' });
    await assertFails(
      setDoc(doc(helper.firestore(), 'service_types', 'new_type'), validServiceTypeData)
    );
  });
});

describe('認証済みユーザー - service_types delete', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'service_types', 'physical_care'), validServiceTypeData);
    });
  });

  it('admin でも service_types を削除できない', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
    await assertFails(deleteDoc(doc(admin.firestore(), 'service_types', 'physical_care')));
  });

  it('デモモードでも service_types を削除できない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(deleteDoc(doc(authed.firestore(), 'service_types', 'physical_care')));
  });
});
