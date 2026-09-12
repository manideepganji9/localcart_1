import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

// Locate service account key
const downloadsDir = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');
const saFiles = [
  path.join(downloadsDir, 'my-localcart-firebase-adminsdk-fbsvc-544d519025.json'),
  path.join(downloadsDir, 'my-localcart-firebase-adminsdk-fbsvc-9ff9ecea6f.json'),
  path.join(downloadsDir, 'my-localcart-firebase-adminsdk-fbsvc-b1b4aac235.json'),
];

let saPath = saFiles.find(p => fs.existsSync(p));

if (!saPath) {
  console.error('No service account key found in Downloads directory.');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
console.log('Using service account for project:', sa.project_id);

function getOAuthToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/devstorage.full_control',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = b64(header) + '.' + b64(claim);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const sig = signer.sign(sa.private_key, 'base64url');
  return unsignedToken + '.' + sig;
}

async function main() {
  const jwt = getOAuthToken();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error('Failed to obtain Google OAuth2 access token:', tokenData);
    process.exit(1);
  }
  const token = tokenData.access_token;
  console.log('Successfully generated OAuth2 access token.');

  const bucketName = 'my-localcart.firebasestorage.app';
  console.log(`Checking bucket: ${bucketName}...`);

  const checkRes = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucketName}?project=${sa.project_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (checkRes.status === 404) {
    console.log(`\nNotice: Bucket "${bucketName}" does not exist yet.`);
    console.log('To initialize it on the free Firebase Spark plan:');
    console.log('1. Visit https://console.firebase.google.com/project/my-localcart/storage');
    console.log('2. Click "Get started"');
    console.log('3. Choose "Start in production mode", choose a location, and click Done.');
    console.log('4. Then re-run this script to automatically apply the CORS policy.\n');
    return;
  }

  const corsConfig = [
    {
      origin: [
        'https://localcart-1.vercel.app',
        'https://my-localcart.firebaseapp.com',
        'https://my-localcart.web.app',
        'http://localhost:5173',
        'http://localhost:3000'
      ],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
      responseHeader: [
        'Content-Type',
        'Authorization',
        'Content-Length',
        'User-Agent',
        'x-goog-resumable',
        'x-firebase-storage-version'
      ],
      maxAgeSeconds: 3600
    }
  ];

  console.log(`Applying CORS configuration to ${bucketName}...`);
  const patchRes = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucketName}?project=${sa.project_id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cors: corsConfig })
  });

  if (patchRes.ok) {
    const data = await patchRes.json();
    console.log('SUCCESS! CORS policy applied to bucket:', bucketName);
    console.log('CORS Rules:', JSON.stringify(data.cors, null, 2));
  } else {
    console.error('Failed to apply CORS policy:', patchRes.status, await patchRes.text());
  }
}

main().catch(console.error);
