import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
    const hash = await bcrypt.hash(password, 10);
    return NextResponse.json({ hash });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
