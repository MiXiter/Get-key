import admin from 'firebase-admin';

if (!admin.apps.length) {
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}
const db = admin.database();

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return json(400, { valid: false, error: 'Missing key' });
  }

  const snap = await db.ref('keys/' + key).once('value');

  if (!snap.exists()) {
    return json(200, { valid: false, error: 'Key not found' });
  }

  const data = snap.val();
  if (Date.now() > data.expires_at) {
    return json(200, { valid: false, error: 'Expired' });
  }

  return json(200, {
    valid: true,
    expires_at: new Date(data.expires_at).toISOString()
  });
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    }
  });
}

export const config = { path: '/api/validate' };
