import { NextResponse } from 'next/server';

const CLOUD_API_SECRET = 'fJX-95cOy2jkNd-8jz81d6leDZU';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const folder = (body as { folder?: string }).folder || 'blogs';
    const timestamp = Math.round(Date.now() / 1000);

    const crypto = await import('crypto');
    const str = `folder=${folder}&timestamp=${timestamp}${CLOUD_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(str).digest('hex');

    return NextResponse.json({ timestamp, signature });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
