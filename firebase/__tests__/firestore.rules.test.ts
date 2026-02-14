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

  it('staff_unavailability に書き込めない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'staff_unavailability', 'su-new'), { reason: '希望休' })
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
