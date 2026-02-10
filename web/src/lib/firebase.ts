import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _emulatorConnected = false;

function getApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

function connectEmulators(dbInstance: Firestore, authInstance: Auth) {
  if (_emulatorConnected || process.env.NEXT_PUBLIC_USE_EMULATOR !== 'true') return;
  _emulatorConnected = true;

  try {
    connectFirestoreEmulator(dbInstance, 'localhost', 8080);
  } catch {
    // 既に接続済みの場合のエラーを無視
  }
  try {
    connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
  } catch {
    // 既に接続済みの場合のエラーを無視
  }
}

function initDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getApp());
    if (!_auth) _auth = getAuth(getApp());
    connectEmulators(_db, _auth);
  }
  return _db;
}

function initAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getApp());
    if (!_db) _db = getFirestore(getApp());
    connectEmulators(_db, _auth);
  }
  return _auth;
}

// Proxyで遅延初期化（SSRビルド時にFirebase初期化を回避）
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    const instance = initDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = initAuth();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
