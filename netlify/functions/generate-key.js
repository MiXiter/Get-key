import admin from 'firebase-admin';

if (!admin.apps.length) {
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}
const db = admin.database();

const LIMIT_PER_DAY  = 5;
const EXPIRE_SECONDS = 3600;

export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const ip = (req.headers.get('x-forwarded-for') || '0.0.0.0')
              .split(',')[0].trim();

  const now = Date.now();
  const cutoff = now - 24 * 3600 * 1000;

  const snap = await db.ref('keys')
    .orderByChild('ip')
    .equalTo(ip)
    .once('value');

  let used = 0;
  snap.forEach(child => {
    const v = child.val();
    if (v && v.created_at > cutoff) used++;
  });

  if (used >= LIMIT_PER_DAY) {
    return json(429, { error: 'Batas tercapai', used, limit: LIMIT_PER_DAY });
  }

  const raw = randomHex(16).toUpperCase();
  const key = `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}`;

  const expires_at = now + EXPIRE_SECONDS * 1000;

  await db.ref('keys/' + key).set({
    key_value: key,
    ip,
    created_at: now,
    expires_at,
    used: false
  });

  return json(200, {
    key,
    expires_at: new Date(expires_at).toISOString(),
    expires_in_seconds: EXPIRE_SECONDS,
    remaining: LIMIT_PER_DAY - used - 1
  });
};

function randomHex(len) {
  const bytes = new Uint8Array(len / 2);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    }
  });
}

export const config = { path: '/api/generate' };
