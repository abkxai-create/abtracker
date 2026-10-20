import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: initialize Firestore with database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Auth Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Application ID & Collection Paths
export const APP_ID = '8df51951-95c4-441c-addd-1bece1e3ebea';
export const BASE_COLLECTION_PATH = `artifacts/${APP_ID}/public/data`;

export const COLLECTIONS = {
  USERS: `${BASE_COLLECTION_PATH}/users`,
  ACCOUNTS: `${BASE_COLLECTION_PATH}/accounts`,
  PROJECTS: `${BASE_COLLECTION_PATH}/projects`,
  SALESPERSONS: `${BASE_COLLECTION_PATH}/salespersons`,
  COMPANIES: `${BASE_COLLECTION_PATH}/companies`,
  INVOICES: `${BASE_COLLECTION_PATH}/invoices`,
  PAYMENTS: `${BASE_COLLECTION_PATH}/payments`,
  PAYMENT_FOLLOWUPS: `${BASE_COLLECTION_PATH}/payment_followups`,
  PROJECT_ACTIVITY: `${BASE_COLLECTION_PATH}/project_activity`,
  REMARKS_HISTORY: `${BASE_COLLECTION_PATH}/remarks_history`,
  COUNTERS: `${BASE_COLLECTION_PATH}/counters`,
  CONFIG: `${BASE_COLLECTION_PATH}/config`,
} as const;

// Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection on Startup
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline check: Please verify network/Firebase configuration.');
    }
    return false;
  }
}
