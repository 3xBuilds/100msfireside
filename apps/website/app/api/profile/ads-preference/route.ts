import { NextRequest, NextResponse } from 'next/server';
import { fetchAPI } from '@/utils/serverActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const PREFERENCE_ENDPOINT = `${backend}/api/users/protected/ads-preference`;

function getAuthHeader(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  return authHeader;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = getAuthHeader(req);
    const res = await fetchAPI(PREFERENCE_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
      cache: 'no-store',
    });
    return NextResponse.json(res.data, { status: res.status });
  } catch (error: any) {
    if (error?.message === 'Missing Authorization header') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[ads-preference] GET failed', error);
    return NextResponse.json({ error: 'Failed to fetch ads preference' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = getAuthHeader(req);
    const body = await req.json();
    const res = await fetchAPI(PREFERENCE_ENDPOINT, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
      },
      body,
      cache: 'no-store',
    });
    return NextResponse.json(res.data, { status: res.status });
  } catch (error: any) {
    if (error?.message === 'Missing Authorization header') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[ads-preference] PUT failed', error);
    return NextResponse.json({ error: 'Failed to update ads preference' }, { status: 500 });
  }
}

