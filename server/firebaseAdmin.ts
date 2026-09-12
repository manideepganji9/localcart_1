let adminApp: any = null;

/**
 * Lazily initialize Firebase Admin SDK.
 * Supports:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY: raw or base64 JSON string
 * 2. GOOGLE_APPLICATION_CREDENTIALS: file path to service account json
 * 3. Individual variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
export async function getFirebaseAdminApp(): Promise<any> {
  if (adminApp) {
    return adminApp;
  }

  const { initializeApp, getApps, cert, applicationDefault } = await import('firebase-admin/app');

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const serviceAccountRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    '';

  let credential: any;

  if (serviceAccountRaw) {
    try {
      let parsed: any;
      const trimmed = serviceAccountRaw.trim();
      if (trimmed.startsWith('{')) {
        parsed = JSON.parse(trimmed);
      } else {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
        parsed = JSON.parse(decoded);
      }
      credential = cert(parsed);
    } catch (err: any) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_KEY format: ${err.message}`);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credential = applicationDefault();
    } catch (err: any) {
      console.warn('Could not load applicationDefault credentials:', err?.message);
    }
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'my-localcart';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      credential = cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } else {
      // Fallback: Try Google Application Default Credentials (managed ambient credentials)
      try {
        credential = applicationDefault();
      } catch (err: any) {
        // Ambient ADC not present
      }
    }
  }

  if (!credential) {
    throw new Error(
      'Server-side Firebase Admin credentials are not configured. ' +
      'Please provide FIREBASE_SERVICE_ACCOUNT_KEY in your server environment variables, or ensure Google Application Default Credentials are configured.'
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'my-localcart';
  adminApp = initializeApp({
    credential,
    projectId,
  });

  return adminApp;
}

export async function getAdminFirestore(): Promise<any> {
  const app = await getFirebaseAdminApp();
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(app);
}

export async function verifyAuthToken(idToken: string): Promise<any> {
  const app = await getFirebaseAdminApp();
  const { getAuth } = await import('firebase-admin/auth');
  return getAuth(app).verifyIdToken(idToken);
}

export type DocumentReference = any;
export type Firestore = any;
export type DecodedIdToken = any;
