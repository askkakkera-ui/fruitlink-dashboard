import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifySession, SESSION_COOKIE, type SessionPayload } from '@/lib/session';

// ── Cloudflare R2 config (all server-side env vars; never exposed to browser) ──
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';        // https://<account>.r2.cloudflarestorage.com
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'fruitlink-ad-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';    // https://pub-xxxx.r2.dev  (no trailing slash)

function r2(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });
}

function getSession(req: NextRequest): Promise<SessionPayload | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

// Namespaces every signed-in user shares: visit/attendance photos ('visits')
// and pre-tenant legacy media ('shared'). Everything else is a tenant folder.
const SHARED_PREFIXES = ['visits', 'shared'];

// The folders this session may write to / delete from. super_admin manages media
// on behalf of any operator, so it is unrestricted; everyone else is confined to
// their own tenant folder (plus the shared namespaces above).
function allowedPrefixes(session: SessionPayload): string[] | 'any' {
  if (session.role === 'super_admin') return 'any';
  return [session.sub, session.owner_id, session.parent_id]
    .filter((v): v is string => !!v)
    .concat(SHARED_PREFIXES);
}

// One path segment, no separators and no traversal — a client-supplied prefix
// must never be able to escape its folder.
function cleanPrefix(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.replace(/[^a-zA-Z0-9._-]/g, '') : '';
  return s && s !== '.' && s !== '..' ? s : '';
}

// Strip the public-URL prefix to recover the object key.
//   https://pub-xxxx.r2.dev/<operator>/<file>  ->  <operator>/<file>
function keyFromUrl(url: string): string | null {
  const base = R2_PUBLIC_URL.replace(/\/+$/, '') + '/';
  if (url.startsWith(base)) return url.slice(base.length);
  return null;
}

// ── POST /api/upload ──────────────────────────────────────────────────────────
// Body JSON: { filename, contentType, operator_id? }
// Returns: { uploadUrl, publicUrl, key, name }
// The browser then PUTs the file bytes directly to uploadUrl (straight to R2,
// bypassing this serverless function — so there is NO 4.5 MB body limit).
export async function POST(request: NextRequest) {
  try {
    // A presigned PUT is a write credential for our bucket — never hand one to
    // an anonymous caller.
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_PUBLIC_URL) {
      return NextResponse.json({ error: 'R2 not configured on server' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const rawName: string = body.filename || 'media';
    const contentType: string = body.contentType || 'application/octet-stream';

    // operator_id is a client hint, not an authorisation. A prefix this session
    // may not write to is quietly replaced with its own folder rather than
    // rejected — a stale fl_operator_id cookie should not fail an upload.
    const allowed = allowedPrefixes(session);
    const requested = cleanPrefix(body.operator_id);
    const operatorId =
      allowed === 'any'
        ? requested || 'shared'
        : allowed.includes(requested)
          ? requested
          : session.sub;

    const clean = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = operatorId + '/' + Date.now() + '_' + clean;

    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    // Presigned URL valid for 10 minutes — enough to upload a large video.
    const uploadUrl = await getSignedUrl(r2(), cmd, { expiresIn: 600 });

    const publicUrl = R2_PUBLIC_URL.replace(/\/+$/, '') + '/' + key;
    return NextResponse.json({ uploadUrl, publicUrl, key, name: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'presign error' }, { status: 500 });
  }
}

// ── DELETE /api/upload ────────────────────────────────────────────────────────
// Body JSON: { url } or { key }
// Removes the object from R2. No-op success if nothing identifiable.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
      return NextResponse.json({ deleted: false, error: 'R2 not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    let key: string | null = typeof body.key === 'string' ? body.key : null;
    if (!key && typeof body.url === 'string') key = keyFromUrl(body.url);

    if (!key) {
      // Could be an old Supabase URL or empty — don't block the campaign delete.
      return NextResponse.json({ deleted: false, reason: 'no r2 key in url' });
    }

    // Deletion is destructive and the key is client-supplied, so unlike upload
    // we refuse an out-of-scope folder instead of rewriting it.
    const allowed = allowedPrefixes(session);
    if (allowed !== 'any') {
      const folder = key.split('/')[0];
      if (key.includes('..') || !allowed.includes(folder)) {
        return NextResponse.json({ deleted: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return NextResponse.json({ deleted: true, key });
  } catch (e: any) {
    return NextResponse.json({ deleted: false, error: e?.message || 'delete error' }, { status: 500 });
  }
}
