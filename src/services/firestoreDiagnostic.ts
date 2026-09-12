import { auth } from './firebase';

export type DiagnosticOpType = 'get' | 'set' | 'update' | 'add' | 'query' | 'listener' | 'delete';

export interface DiagnosticLogPayload {
  path: string;
  operationType: DiagnosticOpType;
  currentRole?: string | null;
  error?: any;
}

export function logFirestoreDiag(payload: DiagnosticLogPayload) {
  const currentFbUser = auth.currentUser;
  const currentUid = currentFbUser?.uid || null;
  const authState = !currentFbUser
    ? 'unauthenticated'
    : currentFbUser.isAnonymous
    ? 'anonymous'
    : 'authenticated';

  if (payload.error) {
    const errorCode = payload.error?.code || 'unknown';
    const errorMessage = payload.error?.message || String(payload.error);

    console.error('🚨 [FIRESTORE DIAGNOSTIC ERROR] 🚨', {
      path: payload.path,
      operationType: payload.operationType,
      authUid: currentUid,
      authState,
      currentRole: payload.currentRole || 'none',
      errorCode,
      errorMessage,
    });

    // Also dispatch a custom event or window log so it is visible in dev preview
    if (typeof window !== 'undefined') {
      (window as any).__LAST_FIRESTORE_DIAG_ERROR__ = {
        path: payload.path,
        operationType: payload.operationType,
        authUid: currentUid,
        authState,
        currentRole: payload.currentRole || 'none',
        errorCode,
        errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  } else {
    console.log('🔍 [FIRESTORE DIAGNOSTIC] Started:', {
      path: payload.path,
      operationType: payload.operationType,
      authUid: currentUid,
      authState,
      currentRole: payload.currentRole || 'none',
    });
  }
}
