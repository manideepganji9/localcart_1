import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  getDocFromServer,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  runTransaction,
  increment,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
} from 'firebase/storage';
import firebaseConfigData from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length ? getApp() : initializeApp(firebaseConfigData);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firebase Storage with reasonable retry window (60s) to allow uploads to finish reliably
export const storage = getStorage(app);
try {
  storage.maxUploadRetryTime = 60000; // 60 seconds max retry for uploads
  storage.maxOperationRetryTime = 60000; // 60 seconds max retry for storage operations
} catch {
  // Safe fallback
}

// Initialize Firestore with specific databaseId as specified by Firebase skill guidelines
export const db = (() => {
  const dbId = (firebaseConfigData as any).firestoreDatabaseId;
  const isCustomDb = dbId && dbId !== '(default)';

  const firestoreSettings = {
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
  };

  try {
    if (isCustomDb) {
      return initializeFirestore(app, firestoreSettings, dbId);
    }
    return initializeFirestore(app, firestoreSettings);
  } catch {
    if (isCustomDb) {
      return getFirestore(app, dbId);
    }
    return getFirestore(app);
  }
})();

// Validate Connection to Firestore on boot with graceful offline handling
if (typeof window !== 'undefined') {
  (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('offline') || msg.includes('unavailable') || msg.includes('permission')) {
        console.info('Firestore connection note: Ready in resilient mode.');
      }
    }
  })().catch(() => {});
}

export enum OperationType {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

export {
  signInWithPopup,
  signInAnonymously,
  fbSignOut,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  runTransaction,
  increment,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
};

export type { FirebaseUser };
