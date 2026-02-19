import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { importCustomers } from '../scripts/import-customers.js';
import { importHelpers } from '../scripts/import-helpers.js';
import { importOrders } from '../scripts/import-orders.js';
import { generateTravelTimes } from '../scripts/generate-travel-times.js';
import { importStaffUnavailability } from '../scripts/import-staff-unavailability.js';
import { clearCollection } from '../scripts/utils/firestore-client.js';

/**
 * 統合テスト: Firestore Emulator が起動している前提
 * 実行前に `firebase emulators:start --project demo-test` が必要
 */
describe('Firestore import integration', () => {
  beforeAll(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }

    // クリア
    const collections = ['customers', 'helpers', 'orders', 'travel_times', 'staff_unavailability'];
    for (const col of collections) {
      await clearCollection(col);
    }
  });

  it('should import 50 customers', async () => {
    const count = await importCustomers();
    expect(count).toBe(50);
  });

  it('should import 20 helpers', async () => {
    const count = await importHelpers();
    expect(count).toBe(20);
  });

  it('should generate orders from weekly_services', async () => {
    const count = await importOrders('2025-01-06');
    expect(count).toBeGreaterThanOrEqual(140);
    expect(count).toBeLessThanOrEqual(200);
  });

  it('should generate travel times for all location pairs', async () => {
    const count = await generateTravelTimes();
    // 51 locations (OFFICE + 50 customers), 51*50 = 2550 pairs
    expect(count).toBe(2550);
  });

  it('should import staff unavailability records', async () => {
    const count = await importStaffUnavailability();
    expect(count).toBe(3);
  });

  it('should have correct customer document structure', async () => {
    const db = getFirestore();
    const doc = await db.collection('customers').doc('C001').get();
    expect(doc.exists).toBe(true);

    const data = doc.data()!;
    expect(data.name).toHaveProperty('family');
    expect(data.name).toHaveProperty('given');
    expect(data.location).toHaveProperty('lat');
    expect(data.location).toHaveProperty('lng');
    expect(data.ng_staff_ids).toBeInstanceOf(Array);
    expect(data.preferred_staff_ids).toBeInstanceOf(Array);
    expect(data.weekly_services).toBeDefined();
    expect(data.service_manager).toBeDefined();
    expect(data.created_at).toBeDefined();
    expect(data.updated_at).toBeDefined();
  });

  it('should have correct helper document structure', async () => {
    const db = getFirestore();
    const doc = await db.collection('helpers').doc('H001').get();
    expect(doc.exists).toBe(true);

    const data = doc.data()!;
    expect(data.name).toHaveProperty('family');
    expect(data.qualifications).toBeInstanceOf(Array);
    expect(typeof data.can_physical_care).toBe('boolean');
    expect(data.weekly_availability).toBeDefined();
    expect(data.preferred_hours).toHaveProperty('min');
    expect(data.preferred_hours).toHaveProperty('max');
  });

  it('should have correct order document structure', async () => {
    const db = getFirestore();
    const snapshot = await db.collection('orders').limit(1).get();
    expect(snapshot.empty).toBe(false);

    const data = snapshot.docs[0].data();
    expect(data.customer_id).toBeDefined();
    expect(data.week_start_date).toBeDefined();
    expect(data.date).toBeDefined();
    expect(data.start_time).toMatch(/^\d{2}:\d{2}$/);
    expect(data.end_time).toMatch(/^\d{2}:\d{2}$/);
    expect(['physical_care', 'daily_living', 'mixed', 'prevention', 'private', 'disability', 'transport_support', 'severe_visiting']).toContain(data.service_type);
    expect(data.status).toBe('pending');
    expect(data.manually_edited).toBe(false);
  });

  it('should have correct travel_time document structure', async () => {
    const db = getFirestore();
    // Use a known distant pair (OFFICE → C009 in Taniyama)
    const doc = await db.collection('travel_times').doc('from_OFFICE_to_C009').get();
    expect(doc.exists).toBe(true);

    const data = doc.data()!;
    expect(data.from_location).toHaveProperty('lat');
    expect(data.to_location).toHaveProperty('lat');
    expect(data.travel_time_minutes).toBeGreaterThan(0);
    expect(data.distance_meters).toBeGreaterThan(0);
    expect(data.source).toBe('dummy');
  });

  it('should have household pairs linked in customers', async () => {
    const db = getFirestore();
    const c001 = (await db.collection('customers').doc('C001').get()).data()!;
    const c002 = (await db.collection('customers').doc('C002').get()).data()!;

    expect(c001.household_id).toBe('H001');
    expect(c002.household_id).toBe('H001');
    expect(c001.location.lat).toBe(c002.location.lat);
    expect(c001.location.lng).toBe(c002.location.lng);
  });

  it('should reference valid staff_ids in constraints', async () => {
    const db = getFirestore();
    const helpersSnap = await db.collection('helpers').get();
    const helperIds = new Set(helpersSnap.docs.map((d) => d.id));

    const customersSnap = await db.collection('customers').get();
    for (const doc of customersSnap.docs) {
      const data = doc.data();
      for (const staffId of data.ng_staff_ids) {
        expect(helperIds.has(staffId)).toBe(true);
      }
      for (const staffId of data.preferred_staff_ids) {
        expect(helperIds.has(staffId)).toBe(true);
      }
    }
  });
});
