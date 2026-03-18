import { NextRequest, NextResponse } from 'next/server';
import { fetchAPI } from '@/utils/serverActions';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_URL not set' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const webhookUrl = `${baseUrl}/api/webhooks/ads`;
  try {
    const res = await fetchAPI(`${backend}/api/ads/protected/rooms/${params.roomId}/start`, {
      method: 'POST',
      body: { webhookUrl },
      headers: {
        Authorization: authHeader,
      },
    });
    return NextResponse.json(res.data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to start ads session' }, { status: 500 });
  }
}

