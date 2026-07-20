// Self-service signup. Everything here used to happen in the browser:
// app/register/page.tsx called /api/hash-password, then INSERTed into operators
// with the anon key — so the client chose every column it wrote. This route owns
// the whole operation server-side, which is what lets /api/hash-password require
// a session.
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || '';
const SUPABASE_KEY = process.env.SB_KEY || ''; // service key only — never anon
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

// A signup is not an operator. PENDING_ROLE is granted nothing anywhere in the
// app and is refused by /api/login until a super_admin promotes the row from
// OperatorsPage. Do not reuse this string for anything else.
export const PENDING_ROLE = 'pending';

// Mirrors validatePassword() in app/register/page.tsx. The client check is UX;
// this one is the rule.
function validatePassword(password: string): string {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Must have at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Must have at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Must have at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Must have at least one special character';
  return '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Registration is not configured on the server' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));

    // Read ONLY these four fields. role, owner_id, plan, permissions and every
    // other column are ignored no matter what the client sends — a self-signup
    // must never be able to name its own role or attach itself to a tenant.
    const name = str(body.name);
    const email = str(body.email).toLowerCase();
    const phone = str(body.phone);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    const pwdError = validatePassword(password);
    if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 });

    const dupRes = await fetch(
      SUPABASE_URL + '/rest/v1/operators?email=eq.' + encodeURIComponent(email) + '&select=id&limit=1',
      { headers },
    );
    const dup = await dupRes.json();
    if (Array.isArray(dup) && dup.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const insertRes = await fetch(SUPABASE_URL + '/rest/v1/operators', {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        name,
        email,
        phone: phone || null,
        password_hash,
        // Stamped explicitly, not left to a DB default: a null role is read as
        // a full operator by /api/login (`operator.role || 'operator'`).
        role: PENDING_ROLE,
        owner_id: null,
      }),
    });

    if (!insertRes.ok) {
      const detail = await insertRes.text().catch(() => '');
      console.error('Register: operator insert failed:', insertRes.status, detail);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Register error:', e?.message);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
