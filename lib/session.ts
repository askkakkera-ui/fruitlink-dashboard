import { SignJWT, jwtVerify } from 'jose';

// SESSION_SECRET must be set in Vercel env (server-only, NOT NEXT_PUBLIC_).
// Generate one with:  openssl rand -base64 48
const secretKey = process.env.SESSION_SECRET || '';
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  sub: string;
  role: string;       // 'super_admin' | 'operator' | 'field_staff'
  name?: string;
  email?: string;
  owner_id?: string;
  permissions?: Record<string, boolean>; // granular feature flags from operator_permissions
};

// Sign a session token (7-day sliding expiry).
export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

// Verify a session token. Returns the payload, or null if invalid/expired/tampered.
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  if (!secretKey) { console.error('SESSION_SECRET not set'); return null; }
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'fl_session';
