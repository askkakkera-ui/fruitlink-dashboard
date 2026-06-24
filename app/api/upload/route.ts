import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Same env pattern as /api/sb — server-side key, never exposed to the browser.
const SB_URL = process.env.SB_URL || process.env.NEXT_PUBLIC_SB_URL || 'https://fpwvutdvwnvrunviporz.supabase.co';
const SB_KEY = process.env.SB_KEY || process.env.NEXT_PUBLIC_SB_KEY || '';

const BUCKET = 'ad-media';

// POST /api/upload  (multipart/form-data with a "file" field, optional "operator_id")
// Uploads the image to the ad-media bucket and returns { url, name, path }.
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const operatorId = (form.get('operator_id') as string) || 'shared';
    const clean = (file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = operatorId + '/' + Date.now() + '_' + clean;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const uploadUrl = SB_URL + '/storage/v1/object/' + BUCKET + '/' + path;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: bytes,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Upload failed: ' + text }, { status: res.status });
    }

    const publicUrl = SB_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
    return NextResponse.json({ url: publicUrl, name: clean, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload error' }, { status: 500 });
  }
}
