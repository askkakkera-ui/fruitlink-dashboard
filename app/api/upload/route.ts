import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_PUBLIC_URL) {
      return NextResponse.json({ error: 'R2 not configured on server' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const rawName: string = body.filename || 'media';
    const contentType: string = body.contentType || 'application/octet-stream';
    const operatorId: string = body.operator_id || 'shared';

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
    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
      return NextResponse.json({ deleted: false, error: 'R2 not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    let key: string | null = body.key || null;
    if (!key && body.url) key = keyFromUrl(body.url);

    if (!key) {
      // Could be an old Supabase URL or empty — don't block the campaign delete.
      return NextResponse.json({ deleted: false, reason: 'no r2 key in url' });
    }

    await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return NextResponse.json({ deleted: true, key });
  } catch (e: any) {
    return NextResponse.json({ deleted: false, error: e?.message || 'delete error' }, { status: 500 });
  }
}
