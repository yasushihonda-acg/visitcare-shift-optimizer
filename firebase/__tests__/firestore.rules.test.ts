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
// 認証済みユーザー: マスタコレクションはwrite不可
// ============================================================
describe('認証済みユーザー - マスタコレクション書き込み拒否', () => {
  it('customers に書き込めない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'customers', 'customer-new'), { name: '新規' })
    );
  });

  it('helpers に書き込めない', async () => {
    const authed = testEnv.authenticatedContext('user-1');
    await assertFails(
      setDoc(doc(authed.firestore(), 'helpers', 'helper-new'), { name: '新規' })
    );
  });

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
