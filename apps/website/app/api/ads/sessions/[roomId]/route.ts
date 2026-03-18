import { NextRequest, NextResponse } from 'next/server';
import { fetchAPI } from '@/utils/serverActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  try {
    const authorization = req.headers.get('Authorization') || 'Bearer dev';
    const res = await fetchAPI(`${URL}/api/ads/protected/sessions/${params.roomId}`, {
      cache: 'no-store',
      headers: {
        Authorization: authorization,
      },
    });
    return NextResponse.json(res.data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}


