// Push notification proxy — forwards to Expo Push API (avoids CORS)
import { NextResponse } from 'next/server';
import { verifyAuth, authErrorResponse } from '@/lib/api/auth';

export async function POST(request: Request) {
  try { await verifyAuth(request); } catch (e) { return authErrorResponse(e); }

  try {
    const body = await request.json();

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await expoRes.json();
    return NextResponse.json(data, { status: expoRes.status });
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Push request failed', message: (err as Error).message }, { status: 500 });
  }
}
