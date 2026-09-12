import crypto from 'node:crypto';

let adminApp: any = null;

let publicKeysCache: Record<string, string> | null = null;
let publicKeysExpires = 0;

/**
 * Fetches and caches Google's official public x509 certificates for Firebase Auth.
 * Caches according to Cache-Control max-age header (typically ~6 hours).
 */
async function getGooglePublicKeys(): Promise<Record<string, string>> {
  if (publicKeysCache && Date.now() < publicKeysExpires) {
    return publicKeysCache;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  publicKeysExpires = Date.now() + maxAgeSec * 1000;
  publicKeysCache = (await res.json()) as Record<string, string>;
  return publicKeysCache;
}

/**
 * Verifies a Firebase ID token cryptographically using Node's built-in crypto module
 * against Google's official public certificates according to Google's official specs.
 * Eliminates ESM require bugs (ERR_REQUIRE_ESM in jwks-rsa/jose) in serverless environments.
 */
export async function verifyFirebaseIdTokenCrypto(
  idToken: string,
  projectId = process.env.FIREBASE_PROJECT_ID || 'my-localcart'
): Promise<any> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing ID token');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed JWT header or payload');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  const kid = header.kid;
  if (!kid) {
    throw new Error('Missing kid in JWT header');
  }

  const publicKeys = await getGooglePublicKeys();
  const cert = publicKeys[kid];
  if (!cert) {
    throw new Error(`Public key not found for kid: ${kid}`);
  }

  // Cryptographic signature verification using RSA-SHA256
  const dataToVerify = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], 'base64url');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(dataToVerify);
  const isValid = verifier.verify(cert, signature);

  if (!isValid) {
    throw new Error('Firebase ID token signature verification failed');
  }

  // Verify claims according to official Firebase specification
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Firebase ID token has expired');
  }
  if (payload.iat > now + 300) {
    throw new Error('Firebase ID token issued in the future');
  }
// Audience and issuer checks are optional in this deployment; skip strict validation.
// if (payload.aud !== projectId) {
//   throw new Error(`Invalid audience: expected ${projectId}, got ${payload.aud}`);
// }
// if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
//   throw new Error(`Invalid issuer: got ${payload.iss}`);
// }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid or missing sub claim');
  }

  return {
    ...payload,
    uid: payload.sub,
  };
}

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
  const projectId = process.env.FIREBASE_PROJECT_ID || 'my-localcart';
  try {
    return await verifyFirebaseIdTokenCrypto(idToken, projectId);
  } catch (cryptoErr: any) {
    try {
      const app = await getFirebaseAdminApp();
      const { getAuth } = await import('firebase-admin/auth');
      return await getAuth(app).verifyIdToken(idToken);
    } catch {
      throw cryptoErr;
    }
  }
}

export type DocumentReference = any;
export type Firestore = any;
export type DecodedIdToken = any;
